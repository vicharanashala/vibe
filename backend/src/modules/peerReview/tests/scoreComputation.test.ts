/**
 * Unit tests for the scoreComputation utility.
 *
 * Covers all 8 doc-prescribed cases:
 *   - 3 reviews, no override, normal score -> trimmed mean per criterion
 *   - 3 reviews, one has teacher override -> override values used
 *   - 2 reviews -> mean without trim
 *   - 1 review  -> single value
 *   - 0 reviews -> 0 (and audit-flagged)
 *   - late + penalty-only -> totalScore multiplied
 *   - late + hard-exclude -> pendingForTeacher=true
 *   - rubric with 4 criteria -> 4 entries in breakdown, sum equals totalScore
 */
import { describe, it, expect } from 'vitest';
import {
  computeFinalScore,
  ScoreComputationInput,
} from '../utils/scoreComputation.js';

const rubric = [
  { criterionId: 'c-1', label: 'Depth', maxPoints: 10 },
  { criterionId: 'c-2', label: 'Clarity', maxPoints: 5 },
  { criterionId: 'c-3', label: 'Polish', maxPoints: 5 },
];

const defaultInput: ScoreComputationInput = {
  rubric,
  reviews: [],
  latePolicy: 'penalty-only',
  latePenaltyPercent: 10,
  isSubmissionLate: false,
};

describe('scoreComputation: 3 reviews, no override', () => {
  it('uses trimmed mean: drops min and max, averages the rest', () => {
    const input: ScoreComputationInput = {
      ...defaultInput,
      reviews: [
        // c-1: scores 3, 7, 8 -> trim -> [7] mean=7
        // c-2: scores 1, 4, 5 -> trim -> [4] mean=4
        // c-3: scores 0, 3, 5 -> trim -> [3] mean=3
        // total = 7+4+3 = 14
        {
          scores: [
            { criterionId: 'c-1', score: 3 },
            { criterionId: 'c-2', score: 1 },
            { criterionId: 'c-3', score: 0 },
          ],
          teacherOverridden: false,
        },
        {
          scores: [
            { criterionId: 'c-1', score: 7 },
            { criterionId: 'c-2', score: 4 },
            { criterionId: 'c-3', score: 3 },
          ],
          teacherOverridden: false,
        },
        {
          scores: [
            { criterionId: 'c-1', score: 8 },
            { criterionId: 'c-2', score: 5 },
            { criterionId: 'c-3', score: 5 },
          ],
          teacherOverridden: false,
        },
      ],
    };
    const r = computeFinalScore(input);
    expect(r.totalScore).toBeCloseTo(14, 5);
    expect(r.breakdown.length).toBe(3);
    expect(r.breakdown.find((b) => b.criterionId === 'c-1')!.meanScore).toBeCloseTo(7, 5);
    expect(r.breakdown.find((b) => b.criterionId === 'c-2')!.meanScore).toBeCloseTo(4, 5);
    expect(r.breakdown.find((b) => b.criterionId === 'c-3')!.meanScore).toBeCloseTo(3, 5);
    expect(r.teacherOverridden).toBe(false);
  });
});

describe('scoreComputation: 3 reviews, one with teacher override', () => {
  it('uses override scores instead of original for the overridden review', () => {
    const input: ScoreComputationInput = {
      ...defaultInput,
      reviews: [
        {
          scores: [
            { criterionId: 'c-1', score: 5 },
            { criterionId: 'c-2', score: 5 },
            { criterionId: 'c-3', score: 5 },
          ],
          teacherOverridden: false,
        },
        {
          // Original was 0, 0, 0 (very harsh) — teacher overrode to 10, 5, 5
          scores: [
            { criterionId: 'c-1', score: 0 },
            { criterionId: 'c-2', score: 0 },
            { criterionId: 'c-3', score: 0 },
          ],
          teacherOverridden: true,
          teacherOverrideScores: [
            { criterionId: 'c-1', score: 10 },
            { criterionId: 'c-2', score: 5 },
            { criterionId: 'c-3', score: 5 },
          ],
        },
        {
          scores: [
            { criterionId: 'c-1', score: 6 },
            { criterionId: 'c-2', score: 4 },
            { criterionId: 'c-3', score: 4 },
          ],
          teacherOverridden: false,
        },
      ],
    };
    const r = computeFinalScore(input);
    // c-1: values [5, 10, 6] -> trim -> [6] mean=6
    // c-2: values [5, 5, 4]  -> trim -> [5] mean=5
    // c-3: values [5, 5, 4]  -> trim -> [5] mean=5
    // total = 6 + 5 + 5 = 16
    expect(r.totalScore).toBeCloseTo(16, 5);
    expect(r.teacherOverridden).toBe(true);
  });
});

describe('scoreComputation: 2 reviews (only 2 came in)', () => {
  it('uses mean without trim', () => {
    const input: ScoreComputationInput = {
      ...defaultInput,
      reviews: [
        {
          scores: [
            { criterionId: 'c-1', score: 4 },
            { criterionId: 'c-2', score: 3 },
            { criterionId: 'c-3', score: 2 },
          ],
          teacherOverridden: false,
        },
        {
          scores: [
            { criterionId: 'c-1', score: 6 },
            { criterionId: 'c-2', score: 4 },
            { criterionId: 'c-3', score: 3 },
          ],
          teacherOverridden: false,
        },
      ],
    };
    const r = computeFinalScore(input);
    // c-1 mean = 5, c-2 mean = 3.5, c-3 mean = 2.5 -> total 11
    expect(r.totalScore).toBeCloseTo(11, 5);
    expect(r.breakdown.find((b) => b.criterionId === 'c-1')!.meanScore).toBe(5);
  });
});

describe('scoreComputation: 1 review', () => {
  it('uses the single value', () => {
    const input: ScoreComputationInput = {
      ...defaultInput,
      reviews: [
        {
          scores: [
            { criterionId: 'c-1', score: 7 },
            { criterionId: 'c-2', score: 4 },
            { criterionId: 'c-3', score: 3 },
          ],
          teacherOverridden: false,
        },
      ],
    };
    const r = computeFinalScore(input);
    expect(r.totalScore).toBeCloseTo(14, 5);
  });
});

describe('scoreComputation: 0 reviews', () => {
  it('returns 0 (caller must flag for teacher)', () => {
    const r = computeFinalScore({ ...defaultInput, reviews: [] });
    expect(r.totalScore).toBe(0);
    for (const b of r.breakdown) expect(b.meanScore).toBe(0);
  });
});

describe('scoreComputation: late + penalty-only', () => {
  it('multiplies totalScore by (1 - latePenaltyPercent/100)', () => {
    const input: ScoreComputationInput = {
      ...defaultInput,
      latePolicy: 'penalty-only',
      latePenaltyPercent: 10,
      isSubmissionLate: true,
      reviews: [
        {
          scores: [
            { criterionId: 'c-1', score: 10 },
            { criterionId: 'c-2', score: 5 },
            { criterionId: 'c-3', score: 5 },
          ],
          teacherOverridden: false,
        },
      ],
    };
    const r = computeFinalScore(input);
    // raw total = 20, penalty = 10% -> 18
    expect(r.totalScore).toBeCloseTo(18, 5);
  });

  it('penalty-only is configurable: 50% penalty halves the score', () => {
    const input: ScoreComputationInput = {
      ...defaultInput,
      latePolicy: 'penalty-only',
      latePenaltyPercent: 50,
      isSubmissionLate: true,
      reviews: [
        {
          scores: [
            { criterionId: 'c-1', score: 10 },
            { criterionId: 'c-2', score: 5 },
            { criterionId: 'c-3', score: 5 },
          ],
          teacherOverridden: false,
        },
      ],
    };
    const r = computeFinalScore(input);
    expect(r.totalScore).toBeCloseTo(10, 5);
  });
});

describe('scoreComputation: late + hard-exclude', () => {
  it('returns pendingForTeacher=true; finalScore=0', () => {
    const input: ScoreComputationInput = {
      ...defaultInput,
      latePolicy: 'hard-exclude',
      latePenaltyPercent: 100,
      isSubmissionLate: true,
      reviews: [
        {
          scores: [
            { criterionId: 'c-1', score: 10 },
            { criterionId: 'c-2', score: 5 },
            { criterionId: 'c-3', score: 5 },
          ],
          teacherOverridden: false,
        },
      ],
    };
    const r = computeFinalScore(input);
    expect(r.pendingForTeacher).toBe(true);
    expect(r.totalScore).toBe(0);
  });

  it('not late + hard-exclude still computes normally', () => {
    const input: ScoreComputationInput = {
      ...defaultInput,
      latePolicy: 'hard-exclude',
      latePenaltyPercent: 100,
      isSubmissionLate: false,
      reviews: [
        {
          scores: [
            { criterionId: 'c-1', score: 10 },
            { criterionId: 'c-2', score: 5 },
            { criterionId: 'c-3', score: 5 },
          ],
          teacherOverridden: false,
        },
      ],
    };
    const r = computeFinalScore(input);
    expect(r.pendingForTeacher).toBeUndefined();
    expect(r.totalScore).toBeCloseTo(20, 5);
  });
});

describe('scoreComputation: rubric with 4 criteria', () => {
  it('returns 4 entries in breakdown, sum equals totalScore', () => {
    const r4 = [
      { criterionId: 'c-1', label: 'A', maxPoints: 10 },
      { criterionId: 'c-2', label: 'B', maxPoints: 10 },
      { criterionId: 'c-3', label: 'C', maxPoints: 10 },
      { criterionId: 'c-4', label: 'D', maxPoints: 10 },
    ];
    const input: ScoreComputationInput = {
      ...defaultInput,
      rubric: r4,
      reviews: [
        {
          scores: [
            { criterionId: 'c-1', score: 8 },
            { criterionId: 'c-2', score: 7 },
            { criterionId: 'c-3', score: 9 },
            { criterionId: 'c-4', score: 6 },
          ],
          teacherOverridden: false,
        },
      ],
    };
    const r = computeFinalScore(input);
    expect(r.breakdown.length).toBe(4);
    const sum = r.breakdown.reduce((acc, b) => acc + b.meanScore, 0);
    expect(r.totalScore).toBeCloseTo(sum, 5);
  });
});

describe('scoreComputation: clamping', () => {
  it('clamps out-of-range scores to 0..maxPoints', () => {
    const input: ScoreComputationInput = {
      ...defaultInput,
      reviews: [
        {
          scores: [
            { criterionId: 'c-1', score: 999 }, // over max (10)
            { criterionId: 'c-2', score: -7 }, // below 0
            { criterionId: 'c-3', score: 5 },
          ],
          teacherOverridden: false,
        },
      ],
    };
    const r = computeFinalScore(input);
    // c-1 clamped to 10, c-2 clamped to 0, c-3 = 5 -> total 15
    expect(r.totalScore).toBeCloseTo(15, 5);
  });
});