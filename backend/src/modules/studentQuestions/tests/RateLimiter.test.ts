/**
 * Rate limiter + spill — deterministic, with fake timers so nothing actually waits.
 */
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {RateLimitedScreeningLlm} from '../services/screening/RateLimitedScreeningLlm.js';
import {FallbackScreeningLlm} from '../services/screening/FallbackScreeningLlm.js';
import {ScreeningLlm, ScreeningLlmError} from '../services/screening/ScreeningLlm.js';

/** A provider that records how many calls it received and answers instantly. */
function counter(name: string) {
  let calls = 0;
  const llm: ScreeningLlm = {
    provider: name,
    model: name,
    modelFor: () => name,
    async askJson() {
      calls++;
      return {ok: true};
    },
  };
  return {llm, calls: () => calls};
}

describe('RateLimitedScreeningLlm', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('spaces requests to the configured RPM', async () => {
    const c = counter('groq');
    // 60 RPM → one request per ~1s.
    const limited = new RateLimitedScreeningLlm(c.llm, 60, 60_000);

    const p1 = limited.askJson('a');
    const p2 = limited.askJson('b');
    const p3 = limited.askJson('c');

    await p1; // first goes immediately
    expect(c.calls()).toBe(1);

    await vi.advanceTimersByTimeAsync(1100);
    await p2;
    expect(c.calls()).toBe(2);

    await vi.advanceTimersByTimeAsync(1100);
    await p3;
    expect(c.calls()).toBe(3);
  });

  it('spills to the next provider when its own queue is too deep', async () => {
    const groq = counter('groq');
    const gemini = counter('gemini');

    // Groq paced at 60 RPM (1 req/s) but only willing to queue 2s; Gemini roomy.
    const chain = new FallbackScreeningLlm([
      new RateLimitedScreeningLlm(groq.llm, 60, 2_000),
      new RateLimitedScreeningLlm(gemini.llm, 60, 60_000),
    ]);

    // Fire a burst of 5 at once. Groq takes the ones whose slot is within 2s;
    // the rest exceed its queue window and spill to Gemini.
    const all = Promise.all(Array.from({length: 5}, (_, i) => chain.askJson(`q${i}`)));
    await vi.advanceTimersByTimeAsync(3000);
    await all;

    expect(groq.calls()).toBeGreaterThan(0);
    expect(gemini.calls()).toBeGreaterThan(0); // the burst genuinely used both budgets
    expect(groq.calls() + gemini.calls()).toBe(5); // nothing dropped
  });

  it('a full outage on the first provider still spills every request', async () => {
    const dead: ScreeningLlm = {
      provider: 'groq',
      model: 'groq',
      modelFor: () => 'groq',
      async askJson() {
        throw new ScreeningLlmError('groq down');
      },
    };
    const gemini = counter('gemini');
    const chain = new FallbackScreeningLlm([
      new RateLimitedScreeningLlm(dead, 60, 60_000),
      new RateLimitedScreeningLlm(gemini.llm, 60, 60_000),
    ]);

    const r = await chain.askJson('q');
    expect(r).toEqual({ok: true});
    expect(gemini.calls()).toBe(1);
  });
});
