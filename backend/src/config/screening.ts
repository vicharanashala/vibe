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

  /**
   * Context (lesson-relevance) checking. ON HOLD by default: until real
   * per-segment transcripts exist, the only available context is the weak
   * graded-stem proxy, which would risk false off-topic rejections. When on,
   * `createQuestion` feeds lesson context to BOTH the on-topic relevance gate and
   * (as a grounding hint) the answer-correctness check. Flip to true to enable.
   */
  contextCheckEnabled: (env('SCREENING_CONTEXT_ENABLED') || 'false') === 'true',

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

  /** Max graded-QB questions compared against for the duplicate check. */
  dedupPoolLimit: Number(env('SCREENING_DEDUP_LIMIT') || '50'),
  /** Transcript characters fed to the on-topic check (keeps cost bounded). */
  contextCharBudget: Number(env('SCREENING_CONTEXT_CHARS') || '2000'),
};
