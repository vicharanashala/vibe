/**
 * Tuning knobs for the peer-reviewed reflections loop.
 *
 * The numbers below encode the v1 policy: a reflection is scored by at most
 * `MAX_REVIEWS_PER_REFLECTION` peers, its average is only trustworthy (and
 * therefore only shown) once at least `MIN_REVIEWS_TO_REVEAL` peers have scored
 * it, and a student unlocks their own score by reviewing
 * `REQUIRED_REVIEWS_TO_UNLOCK` peers on that same item.
 *
 * They are *defaults*, not limits. An instructor may override any of the three
 * per reflection item; these apply when they have not. See
 * {@link ReflectionPolicy} for how an override is resolved and clamped.
 */

/** Hard cap on how many peers may score a single reflection. */
export const MAX_REVIEWS_PER_REFLECTION = 10;

/**
 * Reviews a student must complete (on the same item) before their own score is
 * revealed. Matches MAX_REVIEWS_PER_REFLECTION so the pool balances: every
 * reflection submitted creates demand for exactly as many reviews as its author
 * is asked to supply.
 */
export const REQUIRED_REVIEWS_TO_UNLOCK = 10;

/**
 * Below this many received reviews an average is too noisy to show, so the
 * score stays hidden even for a student who has finished their own reviews.
 */
export const MIN_REVIEWS_TO_REVEAL = 3;

/**
 * Bounds on what an instructor may choose. The upper bound on reviews per
 * reflection is a cost ceiling: each one is a student's time, and a class of
 * 1000 asked for 50 reviews each is 50,000 reviews nobody will finish.
 */
export const POLICY_LIMITS = {
  maxReviewsPerReflection: {min: 1, max: 25},
  requiredReviewsToUnlock: {min: 0, max: 25},
  minReviewsToReveal: {min: 1, max: 25},
} as const;

/** The three instructor-tunable numbers for one reflection item. */
export interface ReflectionPolicy {
  maxReviewsPerReflection: number;
  requiredReviewsToUnlock: number;
  minReviewsToReveal: number;
}

export const DEFAULT_POLICY: ReflectionPolicy = {
  maxReviewsPerReflection: MAX_REVIEWS_PER_REFLECTION,
  requiredReviewsToUnlock: REQUIRED_REVIEWS_TO_UNLOCK,
  minReviewsToReveal: MIN_REVIEWS_TO_REVEAL,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(Math.round(value), min), max);

/**
 * Resolve an item's stored overrides into a usable policy.
 *
 * Every value is clamped rather than rejected, because this runs on the read
 * path: a document written before a bound changed (or edited directly in the
 * database) must still yield a workable policy instead of failing a student's
 * request. The validator rejects bad input at the point of entry; this is the
 * backstop behind it.
 *
 * `minReviewsToReveal` is additionally capped at `maxReviewsPerReflection` — a
 * reflection that may only ever receive 3 reviews but needs 5 to reveal would
 * hide its score permanently.
 */
export function resolvePolicy(
  overrides?: Partial<ReflectionPolicy> | null,
): ReflectionPolicy {
  if (!overrides) return {...DEFAULT_POLICY};

  const maxReviewsPerReflection = clamp(
    overrides.maxReviewsPerReflection ?? DEFAULT_POLICY.maxReviewsPerReflection,
    POLICY_LIMITS.maxReviewsPerReflection.min,
    POLICY_LIMITS.maxReviewsPerReflection.max,
  );
  const requiredReviewsToUnlock = clamp(
    overrides.requiredReviewsToUnlock ?? DEFAULT_POLICY.requiredReviewsToUnlock,
    POLICY_LIMITS.requiredReviewsToUnlock.min,
    POLICY_LIMITS.requiredReviewsToUnlock.max,
  );
  const minReviewsToReveal = Math.min(
    clamp(
      overrides.minReviewsToReveal ?? DEFAULT_POLICY.minReviewsToReveal,
      POLICY_LIMITS.minReviewsToReveal.min,
      POLICY_LIMITS.minReviewsToReveal.max,
    ),
    maxReviewsPerReflection,
  );

  return {
    maxReviewsPerReflection,
    requiredReviewsToUnlock,
    minReviewsToReveal,
  };
}

/** Length bounds for the reflection body, enforced at the validator and service. */
export const MIN_REFLECTION_LENGTH = 100;
export const MAX_REFLECTION_LENGTH = 3000;

/** Inclusive bounds for every rubric criterion and for the self-confidence rating. */
export const MIN_SCORE = 1;
export const MAX_SCORE = 10;

/** Default page size for teacher-facing listings. */
export const DEFAULT_LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 200;
