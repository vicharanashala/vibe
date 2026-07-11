/**
 * Scoring record produced during adaptive candidate evaluation.
 *
 * Holds every piece of diagnostic information needed by
 * AdaptiveQuestionSelector to perform weighted sampling and to emit
 * structured ACRE diagnostic logs.  The record is intentionally flat so
 * that the sampling loop never needs to re-derive values.
 */
export interface CandidateScore {
  questionId: string;
  weight: number;
  matchedFailedTag: boolean;
  repeatedQuestion: boolean;
  bloomLevel: string;
}

/**
 * ACRE V2 — Adaptive Weight Policy
 *
 * Centralises the numeric weighting rules that govern how each candidate
 * question is scored during adaptive (recovery-mode) quiz generation.
 * Keeping the constants here — rather than scattered across selection
 * logic — means the policy can be understood, reviewed, and adjusted in
 * one place without touching the sampling algorithm.
 *
 * ## Weighting rules
 *
 * | Condition                                  | Effect                              |
 * |--------------------------------------------|-------------------------------------|
 * | Question tagged with a failed concept       | Base weight = FAILED_TAG_WEIGHT (5) |
 * | Question not tagged with a failed concept   | Base weight = DEFAULT_WEIGHT (1)    |
 * | Question appeared in the previous attempt   | Base weight × REPEAT_PENALTY (0.2)  |
 *
 * ## What this class intentionally does NOT do
 * - It does not query the database.
 * - It does not decide which questions are eligible for selection.
 * - It does not perform sampling.
 */
export class AdaptiveWeightPolicy {
  /** Weight assigned to questions whose tags overlap a failed concept. */
  static readonly FAILED_TAG_WEIGHT = 5;

  /** Default weight assigned to questions with no failed-concept match. */
  static readonly DEFAULT_WEIGHT = 1;

  /**
   * Multiplier applied to repeated questions to discourage re-selection
   * while still allowing them to appear if the pool is small.
   */
  static readonly REPEAT_PENALTY = 0.2;

  /**
   * Calculates the adaptive selection weight for a single candidate question.
   *
   * The returned weight is used directly as the probability mass in the
   * roulette-wheel sampling performed by AdaptiveQuestionSelector.  A
   * higher weight means a proportionally greater chance of being selected.
   *
   * @param matchedFailedTag - True if the question belongs to a bank whose
   *   tags overlap with the student's failed concept tags from their previous
   *   attempt.
   * @param repeated - True if the question appeared in the student's most
   *   recent attempt and should therefore be de-prioritised.
   * @returns A positive numeric weight.
   */
  static calculate(matchedFailedTag: boolean, repeated: boolean): number {
    const baseWeight = matchedFailedTag
      ? AdaptiveWeightPolicy.FAILED_TAG_WEIGHT
      : AdaptiveWeightPolicy.DEFAULT_WEIGHT;

    return repeated ? baseWeight * AdaptiveWeightPolicy.REPEAT_PENALTY : baseWeight;
  }
}
