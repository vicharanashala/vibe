/**
 * scoreComputation — pure function for the trimmed-mean final score.
 *
 * Phase 5.2.1 deliverable. No I/O, no DB, no state. All inputs and
 * outputs are plain objects so the function is trivial to unit-test.
 *
 * Algorithm:
 *   1. For each rubric criterion, gather the per-review scores (using
 *      teacherOverrideScores when teacherOverridden=true)
 *   2. Compute a per-criterion trimmed mean:
 *      - 0 reviews -> 0 (caller must flag for teacher intervention)
 *      - 1 review  -> that value
 *      - 2 reviews -> mean of the two
 *      - 3+ reviews -> drop the min and max, mean the rest
 *   3. totalScore = sum of per-criterion means
 *   4. If latePolicy === 'penalty-only' and isSubmissionLate: multiply
 *      totalScore by (1 - latePenaltyPercent/100)
 *   5. If latePolicy === 'hard-exclude' and isSubmissionLate: return
 *      { pendingForTeacher: true } — caller sets finalScore=null and
 *      surfaces it to the teacher
 *
 * Returns:
 *   { totalScore, breakdown, teacherOverridden, pendingForTeacher? }
 */

import type { IPeerReviewRubricCriterion } from '#shared/interfaces/models.js';

export interface ScoreComputationInput {
  rubric: IPeerReviewRubricCriterion[];
  reviews: Array<{
    scores: Array<{
      criterionId: string;
      score: number;
      comment?: string;
    }>;
    teacherOverridden: boolean;
    teacherOverrideScores?: Array<{ criterionId: string; score: number }>;
  }>;
  latePolicy: 'penalty-only' | 'hard-exclude';
  latePenaltyPercent: number;
  isSubmissionLate: boolean;
}

export interface ScoreComputationResult {
  totalScore: number;
  breakdown: Array<{
    criterionId: string;
    meanScore: number;
    maxPoints: number;
  }>;
  teacherOverridden: boolean;
  pendingForTeacher?: boolean;
}

function trimmedMean(values: number[]): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0]!;
  if (values.length === 2) return (values[0]! + values[1]!) / 2;
  // 3+ -> drop min + max, mean the rest
  const sorted = values.slice().sort((a, b) => a - b);
  const trimmed = sorted.slice(1, -1);
  const sum = trimmed.reduce((acc, v) => acc + v, 0);
  return sum / trimmed.length;
}

export function computeFinalScore(
  args: ScoreComputationInput,
): ScoreComputationResult {
  const { rubric, reviews, latePolicy, latePenaltyPercent, isSubmissionLate } =
    args;

  // Hard-exclude path: caller will surface to teacher. We still
  // return a 0 result for downstream callers that don't know about
  // the pending flag.
  if (isSubmissionLate && latePolicy === 'hard-exclude') {
    return {
      totalScore: 0,
      breakdown: rubric.map((c) => ({
        criterionId: c.criterionId,
        meanScore: 0,
        maxPoints: c.maxPoints,
      })),
      teacherOverridden: false,
      pendingForTeacher: true,
    };
  }

  let teacherOverridden = false;
  const breakdown = rubric.map((c) => {
    const values: number[] = [];
    for (const r of reviews) {
      if (r.teacherOverridden) {
        teacherOverridden = true;
        const override = r.teacherOverrideScores?.find(
          (o) => o.criterionId === c.criterionId,
        );
        if (override) {
          values.push(clamp(override.score, 0, c.maxPoints));
          continue;
        }
      }
      const original = r.scores.find((s) => s.criterionId === c.criterionId);
      if (original) {
        values.push(clamp(original.score, 0, c.maxPoints));
      }
    }
    return {
      criterionId: c.criterionId,
      meanScore: trimmedMean(values),
      maxPoints: c.maxPoints,
    };
  });

  let totalScore = breakdown.reduce((acc, b) => acc + b.meanScore, 0);

  if (isSubmissionLate && latePolicy === 'penalty-only') {
    const factor = 1 - latePenaltyPercent / 100;
    totalScore = totalScore * factor;
  }

  return {
    totalScore,
    breakdown,
    teacherOverridden,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  if (typeof v !== 'number' || Number.isNaN(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}