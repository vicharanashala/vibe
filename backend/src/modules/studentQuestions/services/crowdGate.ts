/*
 * Crowd-question peer-validation gate.
 *
 * A COLLECTING crowd question (in its "Submitted – Pending Validation" bank)
 * becomes ELIGIBLE — i.e. surfaces to the instructor for approval — only when
 * ALL of the gate criteria below hold. See CROWD_QUESTION_BANK.md.
 *
 * This module is the single source of truth for the thresholds; stage-2
 * response/vote handling calls isEligibleForReview() after each new signal.
 */

/**
 * Minimum number of (ungraded) student answers before the gate can fire, as a
 * function of the course version's active enrollment. A fixed 200 is
 * unreachable on small pilot cohorts, so this scales: half the active cohort,
 * floored at 5 (don't gate on 1-2 responses) and capped at 200 (peer signal
 * beyond that is not meaningfully stronger).
 */
export const MIN_RESPONSES_FOR_GATE_CAP = 200;
export const MIN_RESPONSES_FOR_GATE_FLOOR = 5;
export const MIN_RESPONSES_FRACTION = 0.5;

export function computeMinResponsesForGate(enrolledStudentCount: number): number {
  return Math.min(
    MIN_RESPONSES_FOR_GATE_CAP,
    Math.max(
      MIN_RESPONSES_FOR_GATE_FLOOR,
      Math.ceil(enrolledStudentCount * MIN_RESPONSES_FRACTION),
    ),
  );
}

/** Difficulty band on the proportion answering correctly. */
export const MIN_CORRECT_RATE = 0.3;
export const MAX_CORRECT_RATE = 0.7;

/** Quality ceiling: thumbs-down as a share of all votes must stay below this. */
export const MAX_THUMBS_DOWN_RATE = 0.1;

export interface CrowdGateCounters {
  responseCount: number;
  correctCount: number;
  thumbsUpCount: number;
  thumbsDownCount: number;
}

export interface CrowdGateEvaluation {
  eligible: boolean;
  correctRate: number;
  thumbsDownRate: number;
  /** Which criteria currently pass — useful for instructor/debug surfaces. */
  reasons: {
    hasMinResponses: boolean;
    inDifficultyBand: boolean;
    underThumbsDownCeiling: boolean;
  };
}

/**
 * Evaluate the gate. Returns the computed rates and per-criterion pass flags.
 * `eligible` is true only when every criterion passes. `minResponses` is the
 * caller-resolved threshold (see {@link computeMinResponsesForGate}) — this
 * module stays a pure, dependency-free function of its inputs.
 */
export function evaluateCrowdGate(
  c: CrowdGateCounters,
  minResponses: number,
): CrowdGateEvaluation {
  const correctRate = c.responseCount > 0 ? c.correctCount / c.responseCount : 0;
  const totalVotes = c.thumbsUpCount + c.thumbsDownCount;
  const thumbsDownRate = totalVotes > 0 ? c.thumbsDownCount / totalVotes : 0;

  const hasMinResponses = c.responseCount >= minResponses;
  const inDifficultyBand =
    correctRate >= MIN_CORRECT_RATE && correctRate <= MAX_CORRECT_RATE;
  const underThumbsDownCeiling = thumbsDownRate < MAX_THUMBS_DOWN_RATE;

  return {
    eligible: hasMinResponses && inDifficultyBand && underThumbsDownCeiling,
    correctRate,
    thumbsDownRate,
    reasons: {hasMinResponses, inDifficultyBand, underThumbsDownCeiling},
  };
}

/** Convenience boolean form of {@link evaluateCrowdGate}. */
export function isEligibleForReview(
  c: CrowdGateCounters,
  minResponses: number,
): boolean {
  return evaluateCrowdGate(c, minResponses).eligible;
}
