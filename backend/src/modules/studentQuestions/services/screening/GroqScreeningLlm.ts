import {screeningConfig} from '#root/config/screening.js';
import {ScreeningLlm, ScreeningLlmError, parseJsonObject} from './ScreeningLlm.js';

/**
 * Groq implementation (OpenAI-compatible chat completions).
 *
 * - Forces JSON output (`response_format: json_object`), temperature 0.
 * - Hard per-call timeout via AbortController (a hung provider must not hang a submission).
 * - Retries transient / 429 errors with linear backoff; gives up cleanly (caller fails-closed).
 */
export class GroqScreeningLlm implements ScreeningLlm {
  readonly provider = 'groq';
  readonly model = screeningConfig.groq.model;

  async askJson(prompt: string): Promise<Record<string, unknown>> {
    const {apiKey, url, model} = screeningConfig.groq;
    if (!apiKey) throw new ScreeningLlmError('GROQ_API_KEY not set');

    const body = JSON.stringify({
      model,
      messages: [{role: 'user', content: prompt}],
      temperature: 0,
      response_format: {type: 'json_object'},
    });

    let lastErr: unknown;
    let backoff = 800;
    for (let attempt = 0; attempt <= screeningConfig.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), screeningConfig.timeoutMs);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json'},
          body,
          signal: controller.signal,
        });

        if (res.status === 429 || res.status >= 500) {
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
        await new Promise(r => setTimeout(r, backoff));
        backoff = Math.min(backoff + 800, 4000);
      } finally {
        clearTimeout(timer);
      }
    }
    throw new ScreeningLlmError('groq call failed after retries', lastErr);
  }
}
