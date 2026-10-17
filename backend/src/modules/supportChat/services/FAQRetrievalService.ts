import { inject, injectable } from 'inversify';
import {
  IFAQ,
  FAQRetrievalResult,
  SUPPORT_CHAT_CONFIG,
  SUPPORT_CHAT_TYPES,
} from '../types.js';
import { FAQRepository } from '../repositories/providers/mongodb/index.js';

/**
 * Words carrying no retrieval signal in support questions. Kept deliberately
 * short: over-stripping hurts more than it helps on questions this brief.
 */
const STOP_WORDS = new Set([
  'a', 'about', 'after', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'been', 'but', 'by', 'can', 'cant', 'do', 'does', 'doing', 'dont', 'for',
  'from', 'get', 'getting', 'had', 'has', 'have', 'how', 'i', 'if', 'im', 'in',
  'into', 'is', 'it', 'its', 'me', 'my', 'no', 'not', 'of', 'on', 'or', 'please',
  'so', 'some', 'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they',
  'this', 'to', 'up', 'use', 'want', 'was', 'we', 'what', 'when', 'where', 'which',
  'why', 'will', 'with', 'would', 'you', 'your',
]);

/** Per-field weight for a query term found in an FAQ. */
const FIELD_WEIGHTS = { question: 1, tags: 0.8, answer: 0.5 };

@injectable()
export class FAQRetrievalService {
  private minimaxApiKey = process.env.MINIMAX_API_KEY;

  /**
   * Epoch ms before which the embedding provider is not called again. Set after
   * a failure so one bad key does not add a doomed HTTP round-trip to every
   * chat turn; retrieval keeps working lexically in the meantime.
   */
  private embeddingCooldownUntil = 0;

  constructor(@inject(SUPPORT_CHAT_TYPES.FAQRepo) private faqRepo: FAQRepository) {
    if (!this.minimaxApiKey) {
      console.warn(
        'MINIMAX_API_KEY not set - support chat will match FAQs lexically only'
      );
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) return 0;

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) return 0;

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Conservative suffix stripping, applied to questions and FAQs alike so both
   * sides land on the same form. Without it a learner asking about "completing"
   * videos misses an FAQ that says "completed", which is exactly the kind of
   * near-miss that pushes a real match below the threshold.
   */
  private stem(word: string): string {
    let stemmed = word;

    if (stemmed.length > 4 && stemmed.endsWith('ies')) {
      stemmed = `${stemmed.slice(0, -3)}i`;
    } else if (stemmed.length > 4 && stemmed.endsWith('ses')) {
      stemmed = stemmed.slice(0, -2);
    } else if (stemmed.length > 3 && stemmed.endsWith('s') && !stemmed.endsWith('ss')) {
      stemmed = stemmed.slice(0, -1);
    }

    if (stemmed.length > 5 && stemmed.endsWith('ing')) {
      stemmed = stemmed.slice(0, -3);
    } else if (stemmed.length > 4 && stemmed.endsWith('ed')) {
      stemmed = stemmed.slice(0, -2);
    }

    // Collapses "update"/"updating" onto one form once 'ing' has gone.
    if (stemmed.length > 4 && stemmed.endsWith('e')) {
      stemmed = stemmed.slice(0, -1);
    }

    return stemmed;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
      .map((word) => this.stem(word));
  }

  /**
   * Inverse document frequency over the FAQ set, so that a shared rare term
   * ("proctoring") counts for far more than a shared common one ("course").
   */
  private buildIdf(faqs: IFAQ[]): Map<string, number> {
    const documentFrequency = new Map<string, number>();

    for (const faq of faqs) {
      const terms = new Set(this.tokenize(`${faq.question} ${faq.answer} ${faq.tags.join(' ')}`));
      for (const term of terms) {
        documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
      }
    }

    const idf = new Map<string, number>();
    for (const [term, frequency] of documentFrequency) {
      idf.set(term, Math.log(1 + faqs.length / (1 + frequency)));
    }

    return idf;
  }

  /**
   * Fraction of the query's information (IDF-weighted) that the FAQ covers,
   * discounted by which field the match landed in. 1 means every meaningful
   * query term appears in the FAQ's own question.
   */
  private lexicalScore(
    queryTerms: string[],
    idf: Map<string, number>,
    unseenTermIdf: number,
    faq: IFAQ
  ): number {
    if (queryTerms.length === 0) return 0;

    const questionTerms = new Set(this.tokenize(faq.question));
    const tagTerms = new Set(this.tokenize(faq.tags.join(' ')));
    const answerTerms = new Set(this.tokenize(faq.answer));

    let matched = 0;
    let total = 0;

    for (const term of new Set(queryTerms)) {
      // Unseen terms still count against coverage, at a floor weight, so a
      // question full of terms no FAQ knows cannot score a confident match.
      const weight = idf.get(term) ?? unseenTermIdf;
      total += weight;

      if (questionTerms.has(term)) {
        matched += weight * FIELD_WEIGHTS.question;
      } else if (tagTerms.has(term)) {
        matched += weight * FIELD_WEIGHTS.tags;
      } else if (answerTerms.has(term)) {
        matched += weight * FIELD_WEIGHTS.answer;
      }
    }

    return total === 0 ? 0 : matched / total;
  }

  private embeddingProviderAvailable(): boolean {
    return Boolean(this.minimaxApiKey) && Date.now() >= this.embeddingCooldownUntil;
  }

  private disableEmbeddingsTemporarily(reason: unknown): void {
    this.embeddingCooldownUntil = Date.now() + SUPPORT_CHAT_CONFIG.embeddingCooldownMs;
    console.warn(
      'Support chat embedding provider unavailable, falling back to lexical matching',
      reason
    );
  }

  /**
   * MiniMax embeddings. `type` is part of their contract: stored FAQ vectors
   * are indexed as 'db', the incoming question as 'query'.
   */
  async getEmbedding(text: string, type: 'db' | 'query' = 'query'): Promise<number[]> {
    if (!this.minimaxApiKey) {
      throw new Error('MINIMAX_API_KEY is not configured');
    }

    const groupId = SUPPORT_CHAT_CONFIG.minimaxGroupId;
    const url = `${SUPPORT_CHAT_CONFIG.minimaxApiUrl}/embeddings${
      groupId ? `?GroupId=${groupId}` : ''
    }`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.minimaxApiKey}`,
      },
      body: JSON.stringify({
        model: SUPPORT_CHAT_CONFIG.embeddingModel,
        texts: [text],
        type,
      }),
      signal: AbortSignal.timeout(SUPPORT_CHAT_CONFIG.embeddingTimeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Minimax API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      vectors?: number[][];
      data?: Array<{ embedding: number[] }>;
      base_resp?: { status_code?: number; status_msg?: string };
    };

    // MiniMax reports auth and quota failures with HTTP 200 and a non-zero
    // base_resp.status_code, so response.ok alone proves nothing.
    if (data?.base_resp && data.base_resp.status_code !== 0) {
      throw new Error(
        `Minimax API error ${data.base_resp.status_code}: ${data.base_resp.status_msg}`
      );
    }

    const embedding = data?.vectors?.[0] ?? data?.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('Invalid embedding response from Minimax');
    }

    return embedding;
  }

  /** Embedding, or null if the provider is unconfigured or failing. Never throws. */
  private async tryGetEmbedding(
    text: string,
    type: 'db' | 'query'
  ): Promise<number[] | null> {
    if (!this.embeddingProviderAvailable()) return null;

    try {
      return await this.getEmbedding(text, type);
    } catch (error) {
      this.disableEmbeddingsTemporarily(error);
      return null;
    }
  }

  /**
   * Generates and stores embeddings for the best lexical candidates that lack
   * one. Bounded per request, so a cold FAQ set fills in over a few chat turns
   * instead of firing one API call per FAQ on the first question.
   */
  private async backfillEmbeddings(faqs: IFAQ[]): Promise<void> {
    const pending = faqs
      .filter((faq) => !faq.embedding?.length && faq._id)
      .slice(0, SUPPORT_CHAT_CONFIG.maxEmbeddingBackfillPerRequest);

    for (const faq of pending) {
      const embedding = await this.tryGetEmbedding(`${faq.question} ${faq.answer}`, 'db');
      if (!embedding) return; // provider just went into cooldown

      faq.embedding = embedding;
      await this.faqRepo.setEmbedding(faq._id!, embedding);
    }
  }

  async retrieveFAQ(
    question: string,
    maxResults: number = SUPPORT_CHAT_CONFIG.maxSearchResults
  ): Promise<FAQRetrievalResult | null> {
    try {
      const faqs = await this.faqRepo.findAll({ isActive: true });

      if (faqs.length === 0) {
        console.warn('No active FAQs found');
        return null;
      }

      // Lexical first: it always works, and its ranking decides which FAQs are
      // worth spending embedding calls on.
      const queryTerms = this.tokenize(question);
      const idf = this.buildIdf(faqs);
      // A term no FAQ contains is as informative as one in a single FAQ.
      const unseenTermIdf = Math.log(1 + faqs.length);
      const byLexical = faqs
        .map((faq) => ({
          faq,
          lexical: this.lexicalScore(queryTerms, idf, unseenTermIdf, faq),
        }))
        .sort((a, b) => b.lexical - a.lexical);

      const queryEmbedding = await this.tryGetEmbedding(question, 'query');
      if (queryEmbedding) {
        await this.backfillEmbeddings(byLexical.map((candidate) => candidate.faq));
      }

      const semanticWeight = queryEmbedding ? 0.7 : 0;
      const threshold = queryEmbedding
        ? SUPPORT_CHAT_CONFIG.confidenceThreshold
        : SUPPORT_CHAT_CONFIG.lexicalConfidenceThreshold;

      const scored = byLexical
        .map(({ faq, lexical }) => {
          const similarity =
            queryEmbedding && faq.embedding?.length
              ? this.cosineSimilarity(queryEmbedding, faq.embedding)
              : 0;

          // Reported for observability; neither term is allowed to decide a
          // match on its own.
          const daysSinceUpdate =
            (Date.now() - faq.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
          const recency = Math.min(daysSinceUpdate / 365, 1);
          const popularity = Math.min(faq.usageCount / 100, 0.5);

          const relevance =
            semanticWeight * similarity + (1 - semanticWeight) * lexical;
          const score = Math.min(relevance + popularity * 0.01, 1);

          return { faq, similarity, recency, popularity, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);

      const topResult = scored[0];
      if (!topResult || topResult.score < threshold) {
        return null;
      }

      return topResult as FAQRetrievalResult;
    } catch (error) {
      // A retrieval failure must escalate the question, not 500 the chat turn.
      console.error('Error retrieving FAQ', error);
      return null;
    }
  }

  /** Embedding for a new FAQ, or undefined when the provider is unavailable. */
  async generateEmbeddingForFAQ(faq: Pick<IFAQ, 'question' | 'answer'>): Promise<number[] | undefined> {
    const embedding = await this.tryGetEmbedding(`${faq.question} ${faq.answer}`, 'db');
    return embedding ?? undefined;
  }
}
