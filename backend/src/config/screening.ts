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
    // Reasoning model — carries the two judgement-heavy checks (duplicate, answer).
    model: env('GROQ_MODEL') || 'llama-3.3-70b-versatile',
    // Small+fast model for the admissibility gate, which runs on EVERY submission
    // and is a mechanical classification. Groq's free tier meters requests per
    // model, so moving the always-on check off the reasoning model roughly
    // doubles how many submissions a day the whole pipeline can screen.
    fastModel: env('GROQ_FAST_MODEL') || 'llama-3.1-8b-instant',
    url: env('GROQ_URL') || 'https://api.groq.com/openai/v1/chat/completions',
  },

  anthropic: {
    apiKey: env('ANTHROPIC_CRED'),
    model: env('ANTHROPIC_MODEL') || 'claude-haiku-4-5',
    // Anthropic's cheapest tier is already fast enough for the gate; kept as its
    // own key so the two roles stay independently tunable across providers.
    fastModel: env('ANTHROPIC_FAST_MODEL') || 'claude-haiku-4-5',
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
