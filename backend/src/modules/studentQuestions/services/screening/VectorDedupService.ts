import {injectable, inject} from 'inversify';
import {ObjectId} from 'mongodb';
import {screeningConfig} from '#root/config/screening.js';
import {STUDENT_QUESTION_TYPES} from '../../types.js';
import {
  QuestionVectorRepository,
  VectorHit,
} from '../../repositories/providers/mongodb/QuestionVectorRepository.js';
import {EmbeddingProvider} from './embeddings/EmbeddingProvider.js';
import {LocalEmbeddingProvider} from './embeddings/LocalEmbeddingProvider.js';

/**
 * What the vector stage tells the screening pipeline to do next.
 *
 * `auto_reject` is deliberately NOT a final verdict — see the class doc.
 */
export type VectorDedupOutcome =
  /** A near-identical question already exists. Fast, cheap — and appealable. */
  | {kind: 'auto_reject'; match: VectorHit}
  /** Nothing in the bank is even plausibly related — the LLM call can be skipped. */
  | {kind: 'no_candidates'}
  /** Plausible look-alikes. Hand ONLY these to the LLM judge. */
  | {kind: 'candidates'; hits: VectorHit[]}
  /** Vector search is off or broke — caller falls back to the LLM-only path. */
  | {kind: 'unavailable'};

/**
 * Semantic de-duplication: retrieve, then judge.
 *
 * The vectors do RECALL (find what might be a duplicate); the LLM does PRECISION
 * (decide whether it actually is). They are not interchangeable, and the reason is
 * measured, not assumed — `embedding.calibration.test.ts` shows sentence embeddings
 * barely encode negation: "what should you do when the model overfits" sits at 0.978
 * cosine against "what should you NOT do when the model overfits", above five of the
 * six true duplicates in the labelled set. A cosine threshold therefore cannot be a
 * verdict, and `autoRejectAt` is not treated as one: whatever it rejects is offered
 * back to the student as a one-shot appeal that routes to the LLM judge, whose call
 * is final.
 *
 * What the vectors buy us is real, though: the LLM used to compare against a blind
 * 50-question pool (~2.3k tokens, and silently blind to any duplicate past the 50th).
 * It now sees ~10 genuinely similar candidates, and when nothing is close it is not
 * called at all.
 */
@injectable()
export class VectorDedupService {
  private embedder: EmbeddingProvider = new LocalEmbeddingProvider();

  constructor(
    @inject(STUDENT_QUESTION_TYPES.QuestionVectorRepo)
    private readonly vectors: QuestionVectorRepository,
  ) {}

  /** Test seam: swap in a deterministic embedder without going through DI. */
  setEmbedder(e: EmbeddingProvider): this {
    this.embedder = e;
    return this;
  }

  private get on(): boolean {
    return screeningConfig.vector.enabled && this.vectors.isConfigured();
  }

  /**
   * Add (or refresh) a question's vector so future submissions can be compared
   * against it. Best-effort: indexing must never fail a user-facing write, and a
   * missed vector only means the LLM does slightly more work next time.
   */
  async index(questionId: string, segmentId: string, text: string): Promise<void> {
    if (!this.on || !text.trim()) return;
    try {
      const [embedding] = await this.embedder.embed([text]);
      await this.vectors.upsert({
        questionId: new ObjectId(questionId),
        segmentId: new ObjectId(segmentId),
        text,
        embedding,
        model: this.embedder.model,
        dims: this.embedder.dims,
      });
    } catch (err) {
      console.warn('[screening/vector] index failed (non-fatal):', (err as Error)?.message);
    }
  }

  /**
   * Retrieve look-alikes for a new submission and decide what the pipeline should
   * do with them.
   *
   * `allowAutoReject` is false when the student has appealed a fast-path rejection:
   * the same retrieval runs, but the verdict is left entirely to the LLM.
   */
  async findSimilar(
    segmentId: string,
    questionText: string,
    allowAutoReject = true,
  ): Promise<VectorDedupOutcome> {
    if (!this.on) return {kind: 'unavailable'};

    try {
      const {topK, autoRejectAt, llmFloorAt} = screeningConfig.vector;

      // A segment with no bank yet cannot produce a duplicate — don't pay to look.
      if ((await this.vectors.countForSegment(segmentId)) === 0) {
        return {kind: 'no_candidates'};
      }

      const [queryVector] = await this.embedder.embed([questionText]);
      const hits = await this.vectors.search(segmentId, queryVector, topK);
      if (hits.length === 0) return {kind: 'no_candidates'};

      const top = hits[0];

      if (allowAutoReject && top.cosine >= autoRejectAt) {
        return {kind: 'auto_reject', match: top};
      }

      // Nothing is even in the neighbourhood of the lowest true duplicate we have
      // ever measured — there is nothing for the judge to weigh.
      if (top.cosine < llmFloorAt) return {kind: 'no_candidates'};

      // Only the plausible ones. Anything under the floor is noise in the prompt.
      return {kind: 'candidates', hits: hits.filter(h => h.cosine >= llmFloorAt)};
    } catch (err) {
      // Fail-open: a broken vector store must not block a submission, and must not
      // silently let duplicates through either — the LLM path still runs.
      console.warn('[screening/vector] search failed, falling back to LLM:', (err as Error)?.message);
      return {kind: 'unavailable'};
    }
  }
}
