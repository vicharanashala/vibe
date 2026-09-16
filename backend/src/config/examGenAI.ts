import { env } from '#root/utils/env.js';

export type ExamGenAIProvider = 'minimax' | 'groq' | 'anthropic';

/**
 * Config for the AI exam-question generator (examGenAI module).
 *
 * Provider-agnostic with automatic failover, same idea as
 * src/config/screening.ts's groq/anthropic toggle but one step further: on
 * an individual call, LlmClient walks `providerOrder` in sequence and stops
 * at the first provider that succeeds — MiniMax-M3 (this team's shared vLLM
 * slot) first, Groq (free-tier, fast) as backup, Anthropic last (reuses the
 * same ANTHROPIC_CRED credential as studentQuestions' screening filter).
 * A provider with no API key configured is skipped automatically (see
 * llmProviderFactory.ts), so leaving GROQ_API_KEY/ANTHROPIC_CRED unset just
 * means "no backup", not a startup error.
 */
export const examGenAIConfig = {
  providerOrder: (env('EXAM_GENAI_PROVIDER_ORDER') || 'minimax,groq,anthropic')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean) as ExamGenAIProvider[],

  minimax: {
    apiKey: env('MINIMAX_API_KEY'),
    baseUrl: env('MINIMAX_BASE_URL') || 'https://api.minimax.io',
    // One model covers all three roles (generator/judge/final-judge) — MiniMax-M3
    // is the only model provisioned on this team's shared vLLM slot.
    model: env('MINIMAX_MODEL') || 'MiniMax-M3',
    // Shared-slot limits from the vLLM dashboard ("10 RPS per user · 9 cap").
    // Enforced client-side (see MiniMaxProvider) so this module degrades to
    // queueing its own calls instead of hammering the shared slot into 429s.
    maxConcurrent: Number(env('MINIMAX_MAX_CONCURRENT') || '9'),
    maxRps: Number(env('MINIMAX_MAX_RPS') || '10'),
  },

  // Reuses the exact same GROQ_API_KEY/GROQ_URL vars as
  // src/config/screening.ts — one shared free-tier Groq credential across
  // both modules, same reuse pattern as ANTHROPIC_CRED below.
  groq: {
    apiKey: env('GROQ_API_KEY'),
    baseUrl: env('GROQ_URL')?.replace(/\/chat\/completions\/?$/, '') || 'https://api.groq.com/openai/v1',
    /** Generator + final-judge: needs real reasoning quality. */
    model: env('GROQ_MODEL') || 'openai/gpt-oss-120b',
    /** Per-question Keep/Remove judge: a smaller, DIFFERENT model on purpose
     *  — Groq enforces tokens-per-minute per model, and a single full-course-
     *  materials generator call can nearly exhaust an 8000 TPM cap on its
     *  own. Putting the judge on its own model gives it its own separate
     *  quota pool instead of contending with the generator for the same one. */
    judgeModel: env('EXAM_GENAI_GROQ_JUDGE_MODEL') || 'openai/gpt-oss-20b',
  },

  anthropic: {
    apiKey: env('ANTHROPIC_CRED'),
    /** Question-writing pass. Needs real reasoning quality, so a full model. */
    generatorModel: env('EXAM_GENAI_GENERATOR_MODEL') || 'claude-sonnet-5',
    /** Per-question Keep/Remove screen. Cheap+fast is fine for a binary check. */
    judgeModel: env('EXAM_GENAI_JUDGE_MODEL') || 'claude-haiku-4-5',
    /** Final difficulty/appropriateness/answer-correctness re-check. Needs the
     *  same reasoning quality as generation (it re-verifies the answer), so it
     *  reuses the generator model rather than the cheap judge model. */
    finalJudgeModel: env('EXAM_GENAI_FINAL_JUDGE_MODEL') || 'claude-sonnet-5',
  },

  /** Per-call hard deadline — a slow provider must never hang a job forever.
   *  120s (not 60s): MiniMax-M3 is a reasoning model that spends real time on
   *  its <think> block before answering, and the shared proxy's own gateway
   *  timeout appears to sit somewhere above 90s (observed a 504 there, not a
   *  client-side abort) — this should stay at or above that. */
  timeoutMs: Number(env('EXAM_GENAI_TIMEOUT_MS') || '120000'),

  /** Generate→Judge→Refine loop targets and caps. */
  targetGoodQuestions: Number(env('EXAM_GENAI_TARGET_GOOD') || '20'),
  maxIterations: Number(env('EXAM_GENAI_MAX_ITERATIONS') || '60'),
  /** How many good/bad prior examples get fed back into each generator call. */
  feedbackExampleCount: 5,

  /** If a call fails on EVERY configured provider this many times in a row
   *  (across generate/judge/final-judge calls), the job aborts with a clear
   *  error instead of grinding through the remaining iterations returning
   *  nothing — see QuestionGenerationService. Discovered the hard way: a
   *  dead shared endpoint fails fast (502, not a timeout), so all
   *  maxIterations attempts can burn through in seconds and silently report
   *  "0 questions generated" with no indication anything was actually wrong. */
  consecutiveFailureLimit: Number(env('EXAM_GENAI_FAILURE_LIMIT') || '8'),

  /** In-memory job entries older than this are swept (job store is
   *  process-local and not persisted — see QuestionGenerationService). */
  jobTtlMs: Number(env('EXAM_GENAI_JOB_TTL_MS') || String(60 * 60 * 1000)),
};

/** Picks the model id for a given call role under the given provider.
 *  MiniMax and Groq have one model each covering every role; Anthropic has
 *  separate cheap/full tiers. */
export function modelForRole(provider: ExamGenAIProvider, role: 'generator' | 'judge' | 'final_judge'): string {
  if (provider === 'minimax') return examGenAIConfig.minimax.model;
  if (provider === 'groq') return role === 'judge' ? examGenAIConfig.groq.judgeModel : examGenAIConfig.groq.model;
  if (role === 'judge') return examGenAIConfig.anthropic.judgeModel;
  if (role === 'final_judge') return examGenAIConfig.anthropic.finalJudgeModel;
  return examGenAIConfig.anthropic.generatorModel;
}

/** Very rough $/token estimates for ai_api_logs.cost_estimate — for spend
 *  monitoring only, not a billing source of truth. Update if pricing changes.
 *  MiniMax-M3/Groq have no published per-token rate here yet, so their calls
 *  log 0 cost_estimate (tokens_used is still logged accurately) until one is set. */
export const MODEL_COST_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  'claude-sonnet-5': { input: 0.003, output: 0.015 },
  'claude-haiku-4-5': { input: 0.001, output: 0.005 },
};
