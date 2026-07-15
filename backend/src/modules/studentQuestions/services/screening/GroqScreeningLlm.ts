import {screeningConfig} from '#root/config/screening.js';
import {
  ScreeningLlm,
  ScreeningLlmError,
  ModelTier,
  parseJsonObject,
} from './ScreeningLlm.js';

/**
 * Groq implementation (OpenAI-compatible chat completions).
 *
 * - Forces JSON output (`response_format: json_object`), temperature 0.
 * - Hard per-call timeout via AbortController (a hung provider must not hang a submission).
 * - Retries transient / 429 errors with linear backoff; gives up cleanly (caller fails-closed).
 */
/**
 * `Retry-After` is either a delay in seconds or an HTTP date. Groq sends the
 * former (often fractional, e.g. "7.5"). Returns 0 when the header is absent or
 * unparseable, so the caller falls back to its own backoff.
 */
function parseRetryAfterMs(header: string | null): number {
  if (!header) return 0;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return 0;
}

export class GroqScreeningLlm implements ScreeningLlm {
  readonly provider = 'groq';
  readonly model = screeningConfig.groq.model;

  modelFor(tier: ModelTier): string {
    return tier === 'fast'
      ? screeningConfig.groq.fastModel
      : screeningConfig.groq.model;
  }

  async askJson(
    prompt: string,
    tier: ModelTier = 'reasoning',
  ): Promise<Record<string, unknown>> {
    const {apiKey, url} = screeningConfig.groq;
    if (!apiKey) throw new ScreeningLlmError('GROQ_API_KEY not set');

    const body = JSON.stringify({
      model: this.modelFor(tier),
      messages: [{role: 'user', content: prompt}],
      temperature: 0,
      response_format: {type: 'json_object'},
    });

    let lastErr: unknown;
    let backoff = 800;
    for (let attempt = 0; attempt <= screeningConfig.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), screeningConfig.timeoutMs);
      /** How long the server told us to wait, if it did. 0 = use our own backoff. */
      let serverWaitMs = 0;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json'},
          body,
          signal: controller.signal,
        });

        if (res.status === 429 || res.status >= 500) {
          // A 429 is a token-BUCKET limit, not a transient blip: Groq meters tokens
          // per minute, so the wait it asks for can be tens of seconds. Our own
          // sub-second backoff can never ride that out — it just burns the retries
          // and fails. Honour `retry-after` when the server sends it.
          serverWaitMs = parseRetryAfterMs(res.headers.get('retry-after'));
          throw new ScreeningLlmError(`groq transient ${res.status}`);
        }
        if (!res.ok) {
          throw new ScreeningLlmError(`groq error ${res.status}: ${(await res.text()).slice(0, 200)}`);
        }

        const json = (await res.json()) as any;
        const content: string = json?.choices?.[0]?.message?.content ?? '';
        return parseJsonObject(content);
      } catch (err) {
        lastErr = err;
        const isAbort = (err as Error)?.name === 'AbortError';
        const retriable = isAbort || err instanceof ScreeningLlmError;
        if (attempt === screeningConfig.maxRetries || !retriable) break;

        // Capped, because a student is waiting on this. If the limit needs longer
        // than we are willing to hold the request, we stop and the caller degrades
        // to a manual-review hold — which is the honest outcome, not a hidden stall.
        const wait = Math.min(serverWaitMs || backoff, screeningConfig.maxBackoffMs);
        await new Promise(r => setTimeout(r, wait));
        backoff = Math.min(backoff + 800, 4000);
      } finally {
        clearTimeout(timer);
      }
    }
    throw new ScreeningLlmError('groq call failed after retries', lastErr);
  }
}
