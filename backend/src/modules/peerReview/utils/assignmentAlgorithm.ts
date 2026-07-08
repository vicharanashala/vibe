/**
 * Assignment algorithm: maps a set of student submissions to ReviewAssignments
 * using a circular-shift permutation with collision-check.
 *
 * Pure function — no I/O, no DB, no state. Inputs and outputs are plain
 * objects so the function is trivial to unit-test.
 *
 * Algorithm:
 *   1. N = submissions.length
 *   2. If N < 2 → return insufficient_submissions error
 *   3. target = min(config.target, N - 1) — every submitter gets at least
 *      one reviewer, themselves skipped (so a cohort of 3 can still
 *      satisfy 1-reviewer-each)
 *   4. if target < 1 → insufficient_submissions (defensive)
 *   5. Build a Set of "reviewerId→submitterId" strings from priorPairs
 *      (used for collision detection across past assessments)
 *   6. Try up to maxAttempts (default 50) permutations of the seedable
 *      shuffle. For each:
 *        - For each i in [0,N): submitter = order[i]
 *        - For each k in [1, target]: reviewer = order[(i+k) mod N]
 *        - Reject if reviewer == submitter (defense in depth; can't
 *          happen because k starts at 1)
 *        - Reject if "reviewerId→submitterId" was in priorPairs
 *   7. If no attempts succeeded, fall back to uniform random with no
 *      collision check (the audit log should record the algorithm
 *      version as 'fallback-uniform-random').
 *
 * Seedable RNG: simple LCG (same source is reused across the module).
 * Same seed → identical output, so tests can be deterministic.
 */

export interface AssignmentInput {
  assessmentId: string;
  submissionId: string;
  studentId: string;
}

export interface AssignmentOutput {
  assessmentId: string;
  submissionId: string;
  reviewerId: string;
}

export interface PriorPair {
  reviewerId: string;
  submitterId: string;
}

export interface AssignmentConfig {
  target: number;
  maxAttempts?: number;
  seed?: number;
}

export type AssignmentResult =
  | { ok: true; algorithm: 'circular-shift-collision-check' | 'fallback-uniform-random'; pairs: AssignmentOutput[]; attempts: number }
  | { ok: false; error: 'insufficient_submissions'; n: number };

// ---- RNG -----------------------------------------------------------------

/**
 * Simple LCG (Numerical Recipes constants). Good enough for permutation
 * shuffling; we only need determinism per seed, no cryptographic
 * properties. Same seed → identical sequence.
 */
function makeRng(seed: number): () => number {
  let state = (seed >>> 0) || 1;
  return function next() {
    // LCG: state = (a * state + c) mod m
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/**
 * Fisher-Yates shuffle using the provided RNG. Returns a NEW array
 * (caller-friendly).
 */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---- Public API ---------------------------------------------------------

const DEFAULT_MAX_ATTEMPTS = 50;

export function assignReviewers(
  submissions: AssignmentInput[],
  priorPairs: PriorPair[] = [],
  config: AssignmentConfig,
): AssignmentResult {
  const N = submissions.length;
  if (N < 2) {
    return { ok: false, error: 'insufficient_submissions', n: N };
  }

  const target = Math.min(config.target, N - 1);
  if (target < 1) {
    return { ok: false, error: 'insufficient_submissions', n: N };
  }

  // Pre-compute the prior-pair set as "reviewerId→submitterId" keys. The
  // direction matters: "Alice reviewed Bob before" blocks future
  // (Alice reviews Bob) pairings but NOT (Bob reviews Alice). The doc
  // specifies the pair = the prior grader.
  const priorPairKeys = new Set<string>();
  for (const p of priorPairs) {
    priorPairKeys.add(`${p.reviewerId}\u2192${p.submitterId}`);
  }

  const seed =
    config.seed ??
    (typeof config.target === 'number' ? config.target * 1009 : 42);

  // --- primary attempt loop: collision-checked circular-shift ---
  const maxAttempts = config.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  let lastFallbackPairs: AssignmentOutput[] | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const rng = makeRng(seed + attempt * 31);
    const order = shuffle(submissions, rng);

    const pairs: AssignmentOutput[] = [];
    let collision = false;

    for (let i = 0; i < N; i++) {
      const submitter = order[i];
      for (let k = 1; k <= target; k++) {
        const reviewer = order[(i + k) % N];
        if (reviewer.studentId === submitter.studentId) {
          collision = true;
          break;
        }
        if (
          priorPairKeys.has(`${reviewer.studentId}\u2192${submitter.studentId}`)
        ) {
          collision = true;
          break;
        }
        pairs.push({
          assessmentId: submitter.assessmentId,
          submissionId: submitter.submissionId,
          reviewerId: reviewer.studentId,
        });
      }
      if (collision) break;
    }

    if (!collision) {
      return {
        ok: true,
        algorithm: 'circular-shift-collision-check',
        pairs,
        attempts: attempt,
      };
    }
  }

  // --- fallback: uniform random with no collision check ---
  const fbRng = makeRng(seed + 99999);
  const order = shuffle(submissions, fbRng);
  const pairs: AssignmentOutput[] = [];
  for (let i = 0; i < N; i++) {
    const submitter = order[i];
    // Pick `target` distinct reviewers from `order` excluding self. With
    // N >= 2 and target < N there's always enough non-self candidates.
    const candidates = order.filter(
      (o) => o.studentId !== submitter.studentId,
    );
    const picked = new Set<string>();
    for (const c of candidates) {
      if (picked.size >= target) break;
      picked.add(c.studentId);
    }
    // If candidates ran out (extremely small N), fall back to
    // round-robin through order.
    if (picked.size < target) {
      for (const o of order) {
        if (picked.size >= target) break;
        if (o.studentId !== submitter.studentId) picked.add(o.studentId);
      }
    }
    for (const reviewerId of picked) {
      pairs.push({
        assessmentId: submitter.assessmentId,
        submissionId: submitter.submissionId,
        reviewerId,
      });
    }
  }
  void lastFallbackPairs; // silence unused-var lint for j
  return {
    ok: true,
    algorithm: 'fallback-uniform-random',
    pairs,
    attempts: maxAttempts + 1,
  };
}

/**
 * Convenience: derive the prior-pair list across all past assessments
 * for a course+cohort from the assignments collection. The caller
 * passes `(assessmentIdsExceptCurrent, allReviewAssignmentsForCourse)`.
 *
 * Kept here as a helper because the algorithm-test suite needs to feed
 * realistic priorPairs.
 */
export function pairsFromAssignments(
  assignments: Array<{
    submissionId: string;
    reviewerId: string;
  }>,
  submissionStudentMap: Map<string, string>,
): PriorPair[] {
  const out: PriorPair[] = [];
  for (const a of assignments) {
    const submitterId = submissionStudentMap.get(a.submissionId);
    if (submitterId) {
      out.push({ reviewerId: a.reviewerId, submitterId });
    }
  }
  return out;
}
