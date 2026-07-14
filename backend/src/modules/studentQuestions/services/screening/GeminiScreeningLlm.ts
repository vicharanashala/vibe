import {screeningConfig} from '#root/config/screening.js';
import {
  ScreeningLlm,
  ScreeningLlmError,
  ModelTier,
  parseJsonObject,
} from './ScreeningLlm.js';

/**
 * Google Gemini implementation.
 *
 * Added for one reason: requests-per-minute. Groq's free tier gives 30 RPM and
 * 1,000 requests a day; Gemini's gives a far larger token budget (250k TPM, no
 * daily token cap) and 1,500 requests a day. Neither alone comfortably carries a
 * lecture-sized burst, but they are *different vendors*, so they can be stacked —
 * see FallbackScreeningLlm. (Stacking keys within ONE vendor is a terms violation
 * and is not what this is.)
 *
 * ⚠️ FREE TIER AND STUDENT DATA. Google's terms are explicit: on the unpaid tier
 * they use submitted content to train their models, human reviewers may read it,
 * and they tell you outright not to send personal information. Student-authored
 * text on an institution's LMS is not ours to hand over on that basis. The free
 * tier is fine for development and for the synthetic questions in our test suites;
 * pointing it at real submissions is a decision for the institution, and the paid
 * tier (where Google does not train on your data) is the answer if they say yes.
 */
export class GeminiScreeningLlm implements ScreeningLlm {
  readonly provider = 'gemini';
  readonly model = screeningConfig.gemini.model;

  modelFor(tier: ModelTier): string {
    return tier === 'fast'
      ? screeningConfig.gemini.fastModel
      : screeningConfig.gemini.model;
  }

  async askJson(
    prompt: string,
    tier: ModelTier = 'reasoning',
  ): Promise<Record<string, unknown>> {
    const {apiKey, baseUrl} = screeningConfig.gemini;
    if (!apiKey) throw new ScreeningLlmError('GEMINI_API_KEY not set');

    const model = this.modelFor(tier);
    const url = `${baseUrl}/models/${model}:generateContent`;
    const body = JSON.stringify({
      contents: [{role: 'user', parts: [{text: prompt}]}],
      generationConfig: {
        temperature: 0,
        // Gemini's equivalent of Groq's `response_format: json_object`.
        responseMimeType: 'application/json',
      },
    });

    let lastErr: unknown;
    let backoff = 800;
    for (let attempt = 0; attempt <= screeningConfig.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), screeningConfig.timeoutMs);
      let serverWaitMs = 0;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {'x-goog-api-key': apiKey, 'Content-Type': 'application/json'},
          body,
          signal: controller.signal,
        });

        if (res.status === 429 || res.status >= 500) {
          // Same reasoning as Groq: a 429 is a bucket refill, not a blip.
          serverWaitMs = Number(res.headers.get('retry-after')) * 1000 || 0;
          throw new ScreeningLlmError(`gemini transient ${res.status}`);
        }
        if (!res.ok) {
          throw new ScreeningLlmError(
            `gemini error ${res.status}: ${(await res.text()).slice(0, 200)}`,
          );
        }

        const json = (await res.json()) as any;
        const text: string =
          json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? '').join('') ?? '';
        return parseJsonObject(text);
      } catch (err) {
        lastErr = err;
        const isAbort = (err as Error)?.name === 'AbortError';
        const retriable = isAbort || err instanceof ScreeningLlmError;
        if (attempt === screeningConfig.maxRetries || !retriable) break;
        const wait = Math.min(serverWaitMs || backoff, screeningConfig.maxBackoffMs);
        await new Promise(r => setTimeout(r, wait));
        backoff = Math.min(backoff + 800, 4000);
      } finally {
        clearTimeout(timer);
      }
    }
    throw new ScreeningLlmError('gemini call failed after retries', lastErr);
  }
}
