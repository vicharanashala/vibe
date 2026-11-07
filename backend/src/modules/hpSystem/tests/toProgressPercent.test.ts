import {describe, expect, it} from 'vitest';
import {toProgressPercent} from '../utils/toProgressPercent.js';

describe('toProgressPercent', () => {
  it('keeps a real percentage as it is', () => {
    expect(toProgressPercent(0)).toBe(0);
    expect(toProgressPercent(49.5)).toBe(49.5);
    expect(toProgressPercent(100)).toBe(100);
  });

  it('treats a missing value as no progress', () => {
    expect(toProgressPercent(undefined)).toBe(0);
    expect(toProgressPercent(null)).toBe(0);
  });

  it('treats NaN as no progress, so it cannot pass a "progress < required" check', () => {
    const required = 50;
    const progress = toProgressPercent(NaN);

    expect(progress).toBe(0);
    expect(progress < required).toBe(true);

    // What a plain `?? 0` would have done instead: NaN is not nullish, and
    // NaN is never "less than", so the check would have passed.
    const withNullishOnly = (value?: number) => value ?? 0;
    expect(withNullishOnly(NaN) < required).toBe(false);
  });

  it('reads a numeric string the way the comparison would', () => {
    expect(toProgressPercent('75')).toBe(75);
    expect(toProgressPercent('')).toBe(0);
  });

  it('treats anything else that is not a finite number as no progress', () => {
    expect(toProgressPercent(Infinity)).toBe(0);
    expect(toProgressPercent('not a number')).toBe(0);
    expect(toProgressPercent({})).toBe(0);
  });
});
