import { describe, expect, it } from 'vitest';
import { bktMastery, bktUpdate, DEFAULT_BKT_PARAMS } from '../services/bkt.js';

// Hand-computed against the standard BKT equations (Corbett & Anderson 1995)
// with the default parameters pL0=0.4, pT=0.2, pG=0.2, pS=0.1:
//   correct:   posterior = pL(1-pS) / [pL(1-pS) + (1-pL)pG]
//   incorrect: posterior = pL·pS   / [pL·pS   + (1-pL)(1-pG)]
//   then       pL' = posterior + (1-posterior)·pT

describe('bktUpdate', () => {
  it('raises mastery on a correct answer (0.4 → 0.8)', () => {
    // evidence = 0.4·0.9 + 0.6·0.2 = 0.48; posterior = 0.36/0.48 = 0.75
    // pL' = 0.75 + 0.25·0.2 = 0.8
    expect(bktUpdate(0.4, true)).toBeCloseTo(0.8, 10);
  });

  it('lowers mastery on an incorrect answer (0.4 → ~0.2615)', () => {
    // evidence = 0.4·0.1 + 0.6·0.8 = 0.52; posterior = 0.04/0.52 ≈ 0.076923
    // pL' ≈ 0.076923 + 0.923077·0.2 ≈ 0.261538
    expect(bktUpdate(0.4, false)).toBeCloseTo(0.261538, 5);
  });

  it('stays within [0, 1] for extreme priors', () => {
    expect(bktUpdate(0, true)).toBeGreaterThanOrEqual(0);
    expect(bktUpdate(1, false)).toBeLessThanOrEqual(1);
  });
});

describe('bktMastery', () => {
  it('returns the prior pL0 for an empty history', () => {
    expect(bktMastery([])).toBe(DEFAULT_BKT_PARAMS.pL0);
  });

  it('traces a sequence step by step ([true, true] → ~0.9579)', () => {
    // 0.4 →(correct) 0.8 →(correct) evidence = 0.8·0.9 + 0.2·0.2 = 0.76;
    // posterior = 0.72/0.76 ≈ 0.947368; pL' ≈ 0.957895
    expect(bktMastery([true, true])).toBeCloseTo(0.957895, 5);
  });

  it('converges toward 1 with repeated correct answers, never exceeding it', () => {
    let previous = DEFAULT_BKT_PARAMS.pL0;
    let history: boolean[] = [];
    for (let i = 0; i < 10; i++) {
      history = [...history, true];
      const current = bktMastery(history);
      expect(current).toBeGreaterThan(previous);
      expect(current).toBeLessThanOrEqual(1);
      previous = current;
    }
    expect(previous).toBeGreaterThan(0.99);
  });

  it('weighs recent evidence more: recovering beats regressing', () => {
    // Failing then passing shows learning; passing then failing shows loss.
    expect(bktMastery([false, true])).toBeGreaterThan(
      bktMastery([true, false]),
    );
  });

  it('drops mastery when a mastered student starts failing', () => {
    const mastered = bktMastery([true, true, true]);
    const slipping = bktMastery([true, true, true, false, false]);
    expect(slipping).toBeLessThan(mastered);
  });
});
