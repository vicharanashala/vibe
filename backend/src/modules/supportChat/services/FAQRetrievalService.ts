import { inject, injectable } from 'inversify';
import {
  IFAQ,
  FAQRetrievalResult,
  SUPPORT_CHAT_CONFIG,
  SUPPORT_CHAT_TYPES,
} from '../types.js';
import { FAQRepository } from '../repositories/providers/mongodb/index.js';
@injectable()
export class FAQRetrievalService {
  private minimaxApiKey = process.env.MINIMAX_API_KEY;
  private minimaxApiUrl = process.env.MINIMAX_API_URL || 'https://api.minimax.chat/v1';
  private minimaxEmbeddingModel =
    process.env.MINIMAX_EMBEDDING_MODEL || 'embo-01';

  constructor(@inject(SUPPORT_CHAT_TYPES.FAQRepo) private faqRepo: FAQRepository) {
    if (!this.minimaxApiKey) {
      console.warn('MINIMAX_API_KEY not set - embedding generation will fail');
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

  private calculateKeywordOverlap(query: string, text: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const textWords = text.toLowerCase().split(/\s+/);

    const matches = queryWords.filter((word) => textWords.some((tw) => tw.includes(word)));

    return matches.length / Math.max(queryWords.length, 1);
  }

  async getEmbedding(text: string): Promise<number[]> {
    try {
      if (!this.minimaxApiKey) {
        throw new Error('MINIMAX_API_KEY is not configured');
      }

      const response = await fetch(`${this.minimaxApiUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.minimaxApiKey}`,
        },
        body: JSON.stringify({
          model: this.minimaxEmbeddingModel,
          input: text,
          encoding_format: 'float',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Minimax API error: ${error.message || response.statusText}`);
      }

      const data = await response.json();

      // Minimax returns embeddings in data.data array
      if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
        throw new Error('Invalid embedding response from Minimax');
      }

      return data.data[0].embedding;
    } catch (error) {
      console.error('Error getting embedding from Minimax', error);
      throw error;
    }
  }

  async retrieveFAQ(
    question: string,
    maxResults: number = SUPPORT_CHAT_CONFIG.maxSearchResults
  ): Promise<FAQRetrievalResult | null> {
    try {
      // Get question embedding
      const queryEmbedding = await this.getEmbedding(question);

      // Fetch all active FAQs
      const faqs = await this.faqRepo.findAll({ isActive: true });

      if (faqs.length === 0) {
        console.warn('No active FAQs found');
        return null;
      }

      // Score each FAQ
      const scored = faqs
        .map((faq) => {
          const similarity = faq.embedding ? this.cosineSimilarity(queryEmbedding, faq.embedding) : 0;

          const keywordMatch = this.calculateKeywordOverlap(question, faq.question);

          // Recency factor (newer = lower value = better score)
          const daysSinceUpdate = (Date.now() - faq.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
          const recency = Math.min(daysSinceUpdate / 365, 1);

          // Popularity factor (more usage = higher score boost)
          const popularity = Math.min(faq.usageCount / 100, 0.5);

          // Combined score: 70% semantic similarity + 20% keyword + 10% recency + popularity bonus
          const score =
            similarity * 0.7 + keywordMatch * 0.2 - recency * 0.1 + popularity * 0.0001;

          return {
            faq,
            similarity,
            recency,
            popularity,
            score,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);

      if (!scored[0]) {
        return null;
      }

      const topResult = scored[0];

      if (topResult.score < SUPPORT_CHAT_CONFIG.confidenceThreshold) {
        return null;
      }

      return topResult as FAQRetrievalResult;
    } catch (error) {
      console.error('Error retrieving FAQ', error);
      throw error;
    }
  }

  async generateEmbeddingForFAQ(faq: IFAQ): Promise<number[]> {
    try {
      const textToEmbed = `${faq.question} ${faq.answer}`;
      return await this.getEmbedding(textToEmbed);
    } catch (error) {
      console.error('Error generating FAQ embedding', error);
      throw error;
    }
  }
}
