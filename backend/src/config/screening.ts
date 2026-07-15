import {env} from '#root/utils/env.js';

/**
 * Config for the crowd-question screening filter (studentQuestions module).
 *
 * Provider-agnostic: the demo runs on Groq's free tier; production can switch to
 * Anthropic by flipping SCREENING_PROVIDER, with no code change to the checks.
 */
export const screeningConfig = {
  /**
   * Which provider(s) to screen with. A comma-separated list is a FALLBACK CHAIN,
   * tried in order — e.g. `groq,gemini`.
   *
   * Rate limits are per-vendor, so two vendors' free budgets add up (~1,000 req/day
   * from Groq + ~1,500 from Gemini). A lecture-sized burst then spills into the
   * second provider instead of failing. This is not the same as holding several keys
   * at one vendor, which is a terms violation; these are separate companies.
   */
  provider: (env('SCREENING_PROVIDER') || 'groq') as string,

  /** Master switch — when off, submissions skip screening (fail-open, dev only). */
  enabled: (env('SCREENING_ENABLED') || 'true') !== 'false',

  /**
   * Run every check in ONE LLM call instead of three.
   *
   * Providers meter REQUESTS, and requests-per-minute is the wall we actually hit:
   * free tiers give 10-30 RPM, and a lecture ending with 100 students submitting
   * needs 300 RPM at three calls each — but only 100 at one. It also cuts the daily
   * request count 3x, which is what decides whether 1,000 submissions/day fits in a
   * free tier at all.
   *
   * The trade is accepted, not hidden: one model doing three jobs is slightly less
   * sharp than three specialists. Set false to restore the three-call path, which is
   * still there and still tested.
   */
  singlePass: (env('SCREENING_SINGLE_PASS') || 'true') !== 'false',

  groq: {
    apiKey: env('GROQ_API_KEY'),
    /**
     * Reasoning model — the judgement-heavy checks (duplicate, answer).
     *
     * Measured head-to-head against llama-3.3-70b-versatile on the labelled set:
     * identical accuracy (24/25, same single miss) and 7/7 on the red-team suite.
     * It is then ~4x cheaper on input ($0.15 vs $0.59 per 1M) and — the reason it
     * wins — it is one of the only Groq models with prompt caching, where cached
     * tokens do not count against the rate limit at all. Our prompts are ~87%
     * static, and a cache hit spares 88-94% of them.
     */
    model: env('GROQ_MODEL') || 'openai/gpt-oss-120b',
    /**
     * Small model for the admissibility gate, which runs on EVERY submission and is
     * a mechanical classification rather than a judgement call. Kept inside the
     * gpt-oss family so it keeps prompt caching too — an 8b llama would be cheaper
     * per token but would give that up, which is the more valuable of the two.
     */
    fastModel: env('GROQ_FAST_MODEL') || 'openai/gpt-oss-20b',
    url: env('GROQ_URL') || 'https://api.groq.com/openai/v1/chat/completions',
  },

  anthropic: {
    apiKey: env('ANTHROPIC_CRED'),
    model: env('ANTHROPIC_MODEL') || 'claude-haiku-4-5',
    // Anthropic's cheapest tier is already fast enough for the gate; kept as its
    // own key so the two roles stay independently tunable across providers.
    fastModel: env('ANTHROPIC_FAST_MODEL') || 'claude-haiku-4-5',
  },

  gemini: {
    apiKey: env('GEMINI_API_KEY'),
    // Flash is the right shape here: a cheap, fast classifier, not a reasoner.
    model: env('GEMINI_MODEL') || 'gemini-2.0-flash',
    fastModel: env('GEMINI_FAST_MODEL') || 'gemini-2.0-flash',
    baseUrl: env('GEMINI_BASE_URL') || 'https://generativelanguage.googleapis.com/v1beta',
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

  /**
   * Client-side rate limiting. We pace requests to stay under the provider's RPM
   * ourselves, so a 100-student burst queues and drains instead of firing at once,
   * getting 429'd, and degrading to manual-review holds.
   *
   * `rpm` sits at or just under the real limit of the slowest provider in use
   * (Groq free = 30). Raise it on a paid tier.
   */
  rateLimit: {
    rpm: Number(env('SCREENING_RPM') || '25'),
    /**
     * If a request would wait longer than this for a slot, it spills to the next
     * provider in the chain instead of queueing. Set it from how long a student
     * will tolerate waiting for a verdict — beyond that, another vendor's budget
     * is better than a longer queue.
     */
    maxQueueWaitMs: Number(env('SCREENING_MAX_QUEUE_WAIT_MS') || '8000'),
  },

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
