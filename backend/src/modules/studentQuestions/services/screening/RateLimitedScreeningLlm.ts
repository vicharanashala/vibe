import {ScreeningLlm, ScreeningLlmError, ModelTier} from './ScreeningLlm.js';
import {screeningConfig} from '#root/config/screening.js';

/**
 * Client-side rate limiter around a screening provider.
 *
 * The provider will 429 the moment we cross its requests-per-minute line, and a
 * 429 is expensive: it burns a round-trip and a retry wait. A lecture ending with
 * a hundred students hitting submit at once would otherwise fire a hundred requests
 * in a second, get most of them rejected, and degrade them all to manual-review
 * holds. That is the exact opposite of what we want — the burst is temporary, the
 * work is not urgent to the millisecond, so it should be *absorbed*, not dropped.
 *
 * This is a token bucket: it lets `rpm` requests through per minute and makes the
 * rest WAIT their turn rather than fail. Calls run in submission order (FIFO), so
 * the student who submitted first is screened first. It caps concurrency at 1 by
 * default because these free tiers are the binding constraint, not our throughput —
 * there is nothing to gain from firing two at once when the bucket only refills so
 * fast.
 *
 * SPILL: when several of these are chained (Groq then Gemini), we do NOT want the
 * whole burst to queue on the first provider while the second sits idle — that
 * throws away the second vendor's budget. So if a request's turn is further out
 * than `maxQueueWaitMs`, this rejects with a ScreeningLlmError instead of waiting,
 * which is exactly the signal FallbackScreeningLlm needs to try the next provider.
 * The bucket still refills, so the overflow that could not spill just waits. Net
 * effect: combined throughput is the SUM of the providers' rates, and a 429 is rare
 * instead of routine.
 */
export class RateLimitedScreeningLlm implements ScreeningLlm {
  readonly provider: string;
  readonly model: string;

  /** Minimum spacing between the START of two requests, from the RPM budget. */
  private readonly minGapMs: number;
  private nextAllowedAt = 0;

  constructor(
    private readonly inner: ScreeningLlm,
    rpm = screeningConfig.rateLimit.rpm,
    /** Wait longer than this for a slot → spill to the next provider instead. */
    private readonly maxQueueWaitMs = screeningConfig.rateLimit.maxQueueWaitMs,
  ) {
    this.provider = inner.provider;
    this.model = inner.model;
    // A hair under the true rate: refilling exactly at the limit still trips it
    // because the server's clock and ours are never perfectly aligned.
    this.minGapMs = Math.ceil(60_000 / Math.max(rpm, 1)) + 20;
  }

  modelFor(tier: ModelTier): string {
    return this.inner.modelFor(tier);
  }

  async askJson(prompt: string, tier: ModelTier = 'reasoning'): Promise<Record<string, unknown>> {
    const now = Date.now();
    const slot = Math.max(now, this.nextAllowedAt);
    const wait = slot - now;

    // Too deep a queue → let the fallback chain spill this to the next provider,
    // and do NOT consume a slot we are not going to use.
    if (wait > this.maxQueueWaitMs) {
      throw new ScreeningLlmError(
        `${this.inner.provider} rate-limited (${Math.round(wait / 1000)}s queue)`,
      );
    }

    // Reserve the slot atomically (sync, before any await) so concurrent callers
    // each take the NEXT one and space out correctly.
    this.nextAllowedAt = slot + this.minGapMs;
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    return this.inner.askJson(prompt, tier);
  }
}
