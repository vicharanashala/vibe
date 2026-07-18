/**
 * Bayesian Knowledge Tracing (BKT) — Corbett & Anderson (1995).
 *
 * Models a student's mastery of one concept as a hidden binary state and
 * updates its probability after every observed answer:
 *  - pL0: probability the concept was already known before any practice
 *  - pT:  probability of learning the concept after each practice opportunity
 *  - pG:  probability of answering correctly while NOT knowing it (guess)
 *  - pS:  probability of answering incorrectly while knowing it (slip)
 *
 * Pure math, no I/O — one observation is one graded question answer
 * (true = correct). Kept dependency-free so it is trivially unit-testable
 * and reusable by any caller that can produce an ordered answer sequence.
 */

export interface BKTParams {
  pL0: number;
  pT: number;
  pG: number;
  pS: number;
}

/**
 * Literature-typical defaults (see pyBKT); intentionally conservative:
 * identical for every concept until enough data exists to fit per-concept
 * parameters. Guess/slip are bounded well below 0.5 so the update is stable.
 */
export const DEFAULT_BKT_PARAMS: BKTParams = {
  pL0: 0.4,
  pT: 0.2,
  pG: 0.2,
  pS: 0.1,
};

/** One Bayes update: posterior mastery after observing a correct/incorrect answer. */
export function bktUpdate(
  pL: number,
  correct: boolean,
  params: BKTParams = DEFAULT_BKT_PARAMS,
): number {
  const { pT, pG, pS } = params;
  const evidence = correct
    ? pL * (1 - pS) + (1 - pL) * pG
    : pL * pS + (1 - pL) * (1 - pG);
  // Degenerate parameterizations (evidence 0) can't occur with sane params;
  // guard anyway so a bad configuration can never yield NaN.
  const posterior = evidence > 0 ? (correct ? (pL * (1 - pS)) / evidence : (pL * pS) / evidence) : pL;
  // Learning transition: every practice opportunity may teach the concept.
  return posterior + (1 - posterior) * pT;
}

/** Runs BKT over an ordered answer sequence; returns final P(mastery). */
export function bktMastery(
  observations: boolean[],
  params: BKTParams = DEFAULT_BKT_PARAMS,
): number {
  let pL = params.pL0;
  for (const correct of observations) {
    pL = bktUpdate(pL, correct, params);
  }
  return pL;
}
