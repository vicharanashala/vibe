import {EmbeddingProvider, EmbeddingError} from './EmbeddingProvider.js';

/**
 * Local sentence-embedding model (`all-MiniLM-L6-v2`, 384-d) run in-process via
 * transformers.js.
 *
 * Chosen over a hosted embedding API because it is free, needs no new provider
 * key, and — the reason that actually matters here — student-submitted text never
 * leaves our infrastructure. Groq has no embeddings endpoint, so a hosted option
 * would have meant onboarding a whole new vendor for one call.
 *
 * The model (~23 MB) is downloaded once and cached on disk; the pipeline is
 * built lazily and reused, so only the first embed pays the load cost.
 */
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
const DIMS = 384;

export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly model = MODEL_ID;
  readonly dims = DIMS;

  /** Shared across instances — loading the model twice would just waste memory. */
  private static pipelinePromise: Promise<any> | null = null;

  private static getPipeline(): Promise<any> {
    if (!this.pipelinePromise) {
      this.pipelinePromise = (async () => {
        // Dynamic import: transformers.js is ESM-heavy and only needed when the
        // vector path is actually used, so it stays out of the boot path.
        const {pipeline, env} = await import('@huggingface/transformers');
        // We ship no bundled weights; always resolve from the HF cache/CDN.
        env.allowLocalModels = false;
        return pipeline('feature-extraction', MODEL_ID);
      })().catch(err => {
        // Reset so a transient failure (e.g. no network on first boot) can retry.
        this.pipelinePromise = null;
        throw new EmbeddingError('failed to load the embedding model', err);
      });
    }
    return this.pipelinePromise;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    try {
      const extract = await LocalEmbeddingProvider.getPipeline();
      // mean pooling + L2 normalise → cosine similarity is a dot product.
      const output = await extract(texts, {pooling: 'mean', normalize: true});
      const vectors = output.tolist() as number[][];
      for (const v of vectors) {
        if (v.length !== DIMS) {
          throw new EmbeddingError(`expected ${DIMS} dims, got ${v.length}`);
        }
      }
      return vectors;
    } catch (err) {
      if (err instanceof EmbeddingError) throw err;
      throw new EmbeddingError('embedding failed', err);
    }
  }
}
