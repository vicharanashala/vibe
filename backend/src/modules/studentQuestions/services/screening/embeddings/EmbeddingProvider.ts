/**
 * Provider-agnostic embedding boundary for semantic de-duplication.
 *
 * Mirrors the `ScreeningLlm` seam: the dedup service never touches a model SDK
 * directly, so swapping the local model for a hosted embedding API later is a
 * one-line factory change and nothing downstream moves.
 *
 * Vectors are returned L2-NORMALISED, so cosine similarity is a plain dot
 * product and Atlas's `cosine` similarity is exact.
 */
export interface EmbeddingProvider {
  /** Model id — persisted with every vector so a model change is detectable. */
  readonly model: string;
  /** Vector length. Must match the Atlas vector index's `numDimensions`. */
  readonly dims: number;
  /** Embed a batch. Order of the result matches the order of `texts`. */
  embed(texts: string[]): Promise<number[][]>;
}

/** Thrown when embedding fails — callers fail-open (fall back to the LLM check). */
export class EmbeddingError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'EmbeddingError';
  }
}

/**
 * Cosine similarity of two L2-normalised vectors == their dot product.
 * Guarded so a dimension mismatch fails loudly rather than scoring nonsense.
 */
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new EmbeddingError(`dimension mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
