import {env} from '#root/utils/env.js';

/**
 * Config for the crowd-question screening filter (studentQuestions module).
 *
 * Provider-agnostic: the demo runs on Groq's free tier; production can switch to
 * Anthropic by flipping SCREENING_PROVIDER, with no code change to the checks.
 */
export const screeningConfig = {
  /** 'groq' (demo/free) | 'anthropic' (prod). */
  provider: (env('SCREENING_PROVIDER') || 'groq') as 'groq' | 'anthropic',

  /** Master switch — when off, submissions skip screening (fail-open, dev only). */
  enabled: (env('SCREENING_ENABLED') || 'true') !== 'false',

  groq: {
    apiKey: env('GROQ_API_KEY'),
    // Small+fast is enough for the trivial checks; the labelled test set decides
    // whether the harder duplicate/answer checks need a bigger model.
    model: env('GROQ_MODEL') || 'llama-3.3-70b-versatile',
    url: env('GROQ_URL') || 'https://api.groq.com/openai/v1/chat/completions',
  },

  anthropic: {
    apiKey: env('ANTHROPIC_CRED'),
    model: env('ANTHROPIC_MODEL') || 'claude-haiku-4-5',
  },

  /** Per-call hard deadline (ms) — a slow provider must never hang a submission. */
  timeoutMs: Number(env('SCREENING_TIMEOUT_MS') || '9000'),
  /** Retries on transient/429 errors (with backoff). */
  maxRetries: Number(env('SCREENING_MAX_RETRIES') || '2'),
  /**
   * Ceiling on a single backoff wait.
   *
   * A 429 from Groq is a token-BUCKET limit — it meters tokens per minute, so the
   * `retry-after` it sends can be tens of seconds. We honour that header, but only
   * up to this cap: a student is waiting on the request, and stalling them for a
   * minute is worse than degrading to a manual-review hold. Batch/eval runs that
   * would rather wait than lose the sample raise it (e.g. SCREENING_MAX_BACKOFF_MS=70000).
   */
  maxBackoffMs: Number(env('SCREENING_MAX_BACKOFF_MS') || '5000'),

  /** Max graded-QB questions compared against for the duplicate check. */
  dedupPoolLimit: Number(env('SCREENING_DEDUP_LIMIT') || '50'),
  /** Transcript characters fed to the on-topic check (keeps cost bounded). */
  contextCharBudget: Number(env('SCREENING_CONTEXT_CHARS') || '2000'),

  /**
   * Semantic de-duplication (Atlas Vector Search).
   *
   * The vectors are a RETRIEVER, not a judge. Every threshold below was read off
   * `embedding.calibration.test.ts` — re-run it before changing any of them.
   *
   * The calibration is unambiguous on one point: cosine similarity cannot, on its
   * own, separate a duplicate from a look-alike, because sentence embeddings barely
   * encode negation. "what should you do when the model overfits" scores 0.978
   * against "what should you NOT do when the model overfits" — higher than five of
   * the six true duplicates. So `autoRejectAt` is NOT a safe verdict; it is a fast
   * first pass, and every rejection it makes is offered back to the student as a
   * one-shot "this isn't a duplicate — have it reviewed", which routes to the LLM
   * judge whose call is final.
   */
  vector: {
    /** Off until a vector DB is configured — the pipeline falls back to the LLM-only path. */
    enabled: (env('SCREENING_VECTOR_ENABLED') || 'true') !== 'false',
    /** Separate Atlas cluster for embeddings — the primary DB is never touched. */
    dbUrl: env('VECTOR_DB_URL'),
    dbName: env('VECTOR_DB_NAME') || 'vibe_vectors',
    collection: env('VECTOR_COLLECTION') || 'question_embeddings',
    /** Must match the Atlas index name created on that collection. */
    indexName: env('VECTOR_INDEX_NAME') || 'question_vector_index',

    /** Candidates handed to the LLM judge (was a blind 50-question pool). */
    topK: Number(env('SCREENING_VECTOR_TOP_K') || '10'),

    /**
     * Fast-path reject. Student-appealable — see the note above. Raising it makes
     * the filter timid; lowering it rejects more up front but bounces more good
     * "which is NOT…" questions into the appeal flow.
     */
    autoRejectAt: Number(env('SCREENING_VECTOR_AUTO_REJECT_AT') || '0.93'),

    /**
     * Below this, nothing in the bank is even plausibly related, so the LLM
     * duplicate call is skipped entirely (saves a reasoning-model call).
     * Calibrated well under the lowest true duplicate observed (0.807).
     */
    llmFloorAt: Number(env('SCREENING_VECTOR_LLM_FLOOR_AT') || '0.60'),
  },
};
