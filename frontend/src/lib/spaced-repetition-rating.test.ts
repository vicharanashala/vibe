import { describe, it, expect } from 'vitest';
import { canRateAsGotIt } from './spaced-repetition-rating';

describe('Spaced Repetition: Honest Quality Gating (spaced-repetition-rating.ts)', () => {
  it('disables Got It when a single-select MCQ answer is wrong (SELECT_ONE_IN_LOT)', () => {
    expect(canRateAsGotIt('SELECT_ONE_IN_LOT', false)).toBe(false);
  });

  it('disables Got It when a multi-select MCQ answer is wrong (SELECT_MANY_IN_LOT)', () => {
    expect(canRateAsGotIt('SELECT_MANY_IN_LOT', false)).toBe(false);
  });

  it('enables Got It when a single-select MCQ answer is correct', () => {
    expect(canRateAsGotIt('SELECT_ONE_IN_LOT', true)).toBe(true);
  });

  it('enables Got It when a multi-select MCQ answer is correct', () => {
    expect(canRateAsGotIt('SELECT_MANY_IN_LOT', true)).toBe(true);
  });

  it('enables Got It when correctness is undefined (e.g., initial load before evaluation)', () => {
    expect(canRateAsGotIt('SELECT_ONE_IN_LOT', undefined)).toBe(true);
  });

  it('enables Got It for numeric questions even if isCorrect is false (NUMERIC_ANSWER defensive)', () => {
    expect(canRateAsGotIt('NUMERIC_ANSWER', false)).toBe(true);
  });

  it('enables Got It for numeric questions when isCorrect is undefined', () => {
    expect(canRateAsGotIt('NUMERIC_ANSWER', undefined)).toBe(true);
  });

  it('disables Got It defensively when type is undefined but isCorrect is false', () => {
    expect(canRateAsGotIt(undefined, false)).toBe(false);
  });

  it('enables Got It when both type and isCorrect are undefined', () => {
    expect(canRateAsGotIt(undefined, undefined)).toBe(true);
  });
});
