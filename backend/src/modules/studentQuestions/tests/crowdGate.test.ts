import {describe, it, expect} from 'vitest';
import {
  computeMinResponsesForGate,
  evaluateCrowdGate,
  isEligibleForReview,
  MIN_RESPONSES_FOR_GATE_CAP,
  MIN_RESPONSES_FOR_GATE_FLOOR,
} from '../services/crowdGate.js';

describe('computeMinResponsesForGate', () => {
  it('floors small cohorts at MIN_RESPONSES_FOR_GATE_FLOOR', () => {
    expect(computeMinResponsesForGate(0)).toBe(MIN_RESPONSES_FOR_GATE_FLOOR);
    expect(computeMinResponsesForGate(5)).toBe(MIN_RESPONSES_FOR_GATE_FLOOR);
    expect(computeMinResponsesForGate(10)).toBe(MIN_RESPONSES_FOR_GATE_FLOOR);
  });

  it('scales to half the active cohort in the middle range', () => {
    expect(computeMinResponsesForGate(40)).toBe(20);
    expect(computeMinResponsesForGate(41)).toBe(21); // ceil(20.5)
  });

  it('caps large cohorts at MIN_RESPONSES_FOR_GATE_CAP', () => {
    expect(computeMinResponsesForGate(1000)).toBe(MIN_RESPONSES_FOR_GATE_CAP);
    expect(computeMinResponsesForGate(400)).toBe(MIN_RESPONSES_FOR_GATE_CAP);
  });
});

describe('evaluateCrowdGate', () => {
  it('is eligible when all three criteria pass', () => {
    const result = evaluateCrowdGate(
      {responseCount: 10, correctCount: 5, thumbsUpCount: 9, thumbsDownCount: 0},
      10,
    );
    expect(result.eligible).toBe(true);
    expect(result.correctRate).toBe(0.5);
    expect(result.thumbsDownRate).toBe(0);
    expect(result.reasons).toEqual({
      hasMinResponses: true,
      inDifficultyBand: true,
      underThumbsDownCeiling: true,
    });
  });

  it('is not eligible below the response threshold', () => {
    const result = evaluateCrowdGate(
      {responseCount: 9, correctCount: 5, thumbsUpCount: 9, thumbsDownCount: 0},
      10,
    );
    expect(result.eligible).toBe(false);
    expect(result.reasons.hasMinResponses).toBe(false);
  });

  it('is not eligible when correctRate is outside the difficulty band (too easy)', () => {
    const result = evaluateCrowdGate(
      {responseCount: 10, correctCount: 9, thumbsUpCount: 10, thumbsDownCount: 0},
      10,
    );
    expect(result.eligible).toBe(false);
    expect(result.reasons.inDifficultyBand).toBe(false);
  });

  it('is not eligible when correctRate is outside the difficulty band (too hard)', () => {
    const result = evaluateCrowdGate(
      {responseCount: 10, correctCount: 1, thumbsUpCount: 10, thumbsDownCount: 0},
      10,
    );
    expect(result.eligible).toBe(false);
    expect(result.reasons.inDifficultyBand).toBe(false);
  });

  it('is not eligible when thumbsDownRate meets/exceeds the ceiling', () => {
    const result = evaluateCrowdGate(
      {responseCount: 10, correctCount: 5, thumbsUpCount: 9, thumbsDownCount: 1},
      10,
    );
    expect(result.eligible).toBe(false);
    expect(result.thumbsDownRate).toBe(0.1);
    expect(result.reasons.underThumbsDownCeiling).toBe(false);
  });

  it('treats zero responses/votes as 0 rate rather than dividing by zero', () => {
    const result = evaluateCrowdGate(
      {responseCount: 0, correctCount: 0, thumbsUpCount: 0, thumbsDownCount: 0},
      10,
    );
    expect(result.correctRate).toBe(0);
    expect(result.thumbsDownRate).toBe(0);
    expect(result.eligible).toBe(false);
  });
});

describe('isEligibleForReview', () => {
  it('matches evaluateCrowdGate().eligible', () => {
    const counters = {
      responseCount: 20,
      correctCount: 10,
      thumbsUpCount: 19,
      thumbsDownCount: 1,
    };
    expect(isEligibleForReview(counters, 20)).toBe(
      evaluateCrowdGate(counters, 20).eligible,
    );
    expect(isEligibleForReview(counters, 20)).toBe(true);
    expect(isEligibleForReview(counters, 21)).toBe(false);
  });
});
