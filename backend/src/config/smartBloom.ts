import {env} from '#root/utils/env.js';

/**
 * Config for the Smart Bloom direct path (smartBloom module).
 *
 * The direct path runs Smart Bloom without the AI server: the instructor pastes
 * the transcript (from YouTube's "Show transcript" panel) or uploads a file, and
 * segmentation and question generation call MiniMax directly. It reads the same
 * MINIMAX_* variables as the screening filter and the support assistant, so no
 * new key is needed.
 */
export const smartBloomConfig = {
  minimax: {
    apiKey: env('MINIMAX_API_KEY'),
    model:
      env('SMART_BLOOM_MINIMAX_MODEL') || env('MINIMAX_MODEL') || 'MiniMax-M3',
    // MINIMAX_URL is the full endpoint (screening's variable); MINIMAX_API_URL is the
    // base URL the support assistant uses. Honour either, so a key issued for a
    // regional MiniMax host is always sent to that host.
    url:
      env('MINIMAX_URL') ||
      (env('MINIMAX_API_URL')
        ? `${env('MINIMAX_API_URL')!.replace(/\/+$/, '')}/chat/completions`
        : 'https://api.minimax.io/v1/chat/completions'),
  },

  /**
   * Per-call deadline (ms). Generating a segment's questions takes far longer
   * than a screening check, and each call must still finish inside Cloud Run's
   * request timeout (300 s by default).
   */
  llmTimeoutMs: Number(env('SMART_BLOOM_LLM_TIMEOUT_MS') || '150000'),
  llmMaxRetries: Number(env('SMART_BLOOM_LLM_MAX_RETRIES') || '1'),

  /** Largest request body the direct routes accept (transcripts, curated questions). */
  maxBodySize: env('SMART_BLOOM_MAX_BODY_SIZE') || '5mb',
};
