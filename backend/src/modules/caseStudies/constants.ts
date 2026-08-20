/**
 * Tuning knobs for the case-studies write/review loop.
 *
 * Win model: Model A (win-count) per the 2026-08-12 decision recorded in
 * TASK.md's "Discovered mid-process" section — a response needs
 * WINS_REQUIRED wins, uncapped total comparisons, no majority vote, and
 * losses never count against it.
 */

/** Minimum word count for the steelman field (element 2a) — enforced server-side. */
export const ELEMENT_2A_MIN_WORDS = 25;

/** Soft guidance ceiling for the total of all six response fields — shown in the UI, not hard-blocked. */
export const RESPONSE_TOTAL_GUIDANCE_MAX = 200;

/** Times a response must be picked as "better" before it leaves the review pool. */
export const WINS_REQUIRED = 7;

/**
 * Soft floor shown to reviewers ("N of 7 done") — not an enforced ceiling.
 * Milestone 0's resolved default: reviewing is open-ended, a participant may
 * always choose to do more than the floor.
 */
export const REVIEWER_MIN_PICKS_PER_CASE = 7;

/** The reading-timer formula's anchor rate — the planning transcript's own worked example. */
export const WORDS_PER_MINUTE_NON_NATIVE = 75;

/**
 * Extra time on top of raw reading time, as a fraction of it. Flagged
 * tunable — the source transcript floated 25%/40%/50%; 40% was chosen as the
 * Milestone-0 default and is meant to be revisited live with the client
 * rather than treated as settled.
 */
export const THINKING_TIME_FRACTION = 0.4;

export const DEFAULT_LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 200;

/**
 * Fallbacks used when a course version has no CourseSetting document yet
 * (mirrors the defaults `CourseSettingService.readCourseSettings` writes on
 * first read) — see `CourseSetting.settings.caseStudyStrictUnlockEnabled` /
 * `.caseStudyWeakStreakThreshold`.
 */
export const DEFAULT_STRICT_UNLOCK_ENABLED = true;
export const DEFAULT_WEAK_STREAK_THRESHOLD = 3;

/**
 * Number of FLAGGED verdicts on a single response that triggers automatic
 * withdrawal from the review pool. Both responses in a flagged pair receive
 * a flag, so this is reached independently per response.
 */
export const UNJUDGEABLE_FLAG_THRESHOLD = 2;

/**
 * Word count for the response cap and the reading-timer formula. Deliberately
 * not `.split(' ')` — case-study bodies and responses mix Hindi and English
 * freely, and a naive ASCII split either double-counts or mis-splits
 * Devanagari text. This counts runs of letters/combining-marks/digits, so a
 * combining vowel sign stays attached to its base consonant instead of
 * splitting one word into two.
 */
export function countWords(text: string): number {
  const matches = text.trim().match(/[\p{L}\p{M}\p{N}]+/gu);
  return matches ? matches.length : 0;
}

/**
 * The reading-timer lock formula: minimum time is computed from both steelman
 * word counts. E.g. two 50-word steelmans → 100 / 1.25 * 1.4 ≈ 112 seconds.
 */
export function computeMinimumScreenTimeSeconds(
  wordCountA: number,
  wordCountB: number,
): number {
  const combinedWordCount = wordCountA + wordCountB;
  const baseReadingSeconds =
    combinedWordCount / (WORDS_PER_MINUTE_NON_NATIVE / 60);
  return Math.round(baseReadingSeconds * (1 + THINKING_TIME_FRACTION));
}
