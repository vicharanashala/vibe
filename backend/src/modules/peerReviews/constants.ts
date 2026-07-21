/**
 * Tuning knobs for the peer-reviewed reflections loop.
 *
 * The numbers below encode the v1 policy agreed for the feature:
 * a reflection is scored by at most `MAX_REVIEWS_PER_REFLECTION` peers, its
 * average is only trustworthy (and therefore only shown) once at least
 * `MIN_REVIEWS_TO_REVEAL` peers have scored it, and a student unlocks their own
 * score by reviewing `REQUIRED_REVIEWS_TO_UNLOCK` peers for that same section.
 */

/** Hard cap on how many peers may score a single reflection. */
export const MAX_REVIEWS_PER_REFLECTION = 10;

/**
 * Reviews a student must complete (within the same section) before their own
 * score is revealed. Matches MAX_REVIEWS_PER_REFLECTION so the pool balances:
 * every reflection submitted creates demand for exactly as many reviews as its
 * author is asked to supply.
 */
export const REQUIRED_REVIEWS_TO_UNLOCK = 10;

/**
 * Below this many received reviews an average is too noisy to show, so the
 * score stays hidden even for a student who has finished their own reviews.
 */
export const MIN_REVIEWS_TO_REVEAL = 3;

/** Length bounds for the reflection body, enforced at the validator and service. */
export const MIN_REFLECTION_LENGTH = 100;
export const MAX_REFLECTION_LENGTH = 3000;

/** Inclusive bounds for every rubric criterion and for the self-confidence rating. */
export const MIN_SCORE = 1;
export const MAX_SCORE = 10;

/** Default page size for teacher-facing listings. */
export const DEFAULT_LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 200;
