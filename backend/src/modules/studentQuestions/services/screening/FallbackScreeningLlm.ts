import {ScreeningLlm, ScreeningLlmError, ModelTier} from './ScreeningLlm.js';

/**
 * Try each provider in order; move on when one is rate-limited or down.
 *
 * Rate limits are per-VENDOR, so two vendors' budgets add up. Groq's free tier
 * carries ~1,000 requests a day and Gemini's ~1,500; stacked, the pipeline has
 * ~2,500 — and when a lecture ends and a hundred students submit at once, the
 * burst spills from the first provider into the second instead of failing.
 *
 * This is emphatically NOT the same as holding several keys at one vendor, which
 * is a terms violation. These are different companies with separate quotas.
 *
 * Order matters: put the provider you trust most first. It handles everything until
 * it runs out, so the fallback only sees traffic the primary could not take — which
 * also means a quality difference between them only affects the overflow.
 */
export class FallbackScreeningLlm implements ScreeningLlm {
  readonly provider: string;
  readonly model: string;

  constructor(private readonly providers: ScreeningLlm[]) {
    if (providers.length === 0) {
      throw new ScreeningLlmError('FallbackScreeningLlm needs at least one provider');
    }
    this.provider = providers.map(p => p.provider).join('→');
    this.model = providers[0].model;
  }

  modelFor(tier: ModelTier): string {
    return this.providers[0].modelFor(tier);
  }

  async askJson(
    prompt: string,
    tier: ModelTier = 'reasoning',
  ): Promise<Record<string, unknown>> {
    let lastErr: unknown;
    for (const p of this.providers) {
      try {
        return await p.askJson(prompt, tier);
      } catch (err) {
        lastErr = err;
        // Only a provider-level failure is worth failing over — a malformed verdict
        // is the model's fault and asking a different one will not fix the prompt.
        if (!(err instanceof ScreeningLlmError)) throw err;
        console.warn(
          `[screening] ${p.provider} unavailable, falling back:`,
          (err as Error)?.message,
        );
      }
    }
    throw new ScreeningLlmError('all screening providers failed', lastErr);
  }
}
