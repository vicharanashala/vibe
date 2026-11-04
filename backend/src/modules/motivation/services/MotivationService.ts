/**
 * MotivationService — pure functions that compute badge progress,
 * status snapshots, and learner categories from a flat list of
 * ReviewItem documents.
 *
 * No I/O happens here. The MotivationController fetches items via
 * ReviewItemRepository and passes the array in. This keeps the
 * service testable in isolation (see motivation.test.ts).
 *
 * Keep the badge catalogue in sync with the frontend copy in
 * `frontend/src/lib/motivation-api.ts` and the locked design in
 * PLAN_MOTIVATION_SYSTEM.md.
 *
 * v1 limitation: IReviewItem tracks SM-2 state (n, EF, interval_days)
 * but does NOT track a separate `review_count` field. Counts of
 * "how many times did this student review this card" are approximated
 * via `n + (lapses ? : 0)`. The badge criteria below are tuned to
 * the available fields; richer metrics (total review count per item)
 * are deferred to v1.1 when the schema grows a `review_count` field.
 */

import { IReviewItem } from '../../spacedRepetition/interfaces/IReviewItem.js';
import {
  Badge,
  BadgeProgress,
  BadgeTier,
  NextBadgeProximity,
  LearnerCategory,
  StatusMetric,
  StatusSnapshot,
  StatusValue,
} from '../interfaces/IMotivation.js';

// ── Badge catalogue ────────────────────────────────────────────────────────

export const BADGE_CATALOGUE: Badge[] = [
  // Tier 1 — Entry
  {
    id: 'dwarapala',
    name: 'Dwarapala',
    sanskrit: 'द्वारपाल',
    emoji: '🚪',
    tier: 'entry',
    criteria: 'Answer your first 10 review cards.',
    description: 'Guardian of the door — your first review awaits.',
  },
  {
    id: 'pranam',
    name: 'Pranam',
    sanskrit: 'प्रणाम',
    emoji: '🙏',
    tier: 'entry',
    criteria: 'Complete 5 reviews in a single day.',
    description: 'A bow of respect — five in one sitting.',
  },
  {
    id: 'kanchuki',
    name: 'Kanchuki',
    sanskrit: 'कांचुकी',
    emoji: '👘',
    tier: 'entry',
    criteria: 'Reach 7-day review streak.',
    description: 'The attendant — seven days steady.',
  },
  // Tier 2 — Apprentice
  {
    id: 'sipahi',
    name: 'Sipahi',
    sanskrit: 'सिपाही',
    emoji: '🛡️',
    tier: 'apprentice',
    criteria: 'Reach 80% retention across 20 reviews.',
    description: 'Soldier — defending what you know.',
  },
  {
    id: 'sukh-dukh',
    name: 'Sukh Dukh',
    sanskrit: 'सुख-दुख',
    emoji: '☯️',
    tier: 'apprentice',
    criteria: 'Recover a missed card (review + EF rises again).',
    description: 'Joy and sorrow — you bounced back.',
  },
  {
    id: 'vaidya',
    name: 'Vaidya',
    sanskrit: 'वैद्य',
    emoji: '💊',
    tier: 'apprentice',
    criteria: 'Reach 90-day review streak.',
    description: 'Healer — the long road is yours.',
  },
  // Tier 3 — Courtier
  {
    id: 'kohinoor',
    name: 'Kohinoor',
    sanskrit: 'कोहिनूर',
    emoji: '💎',
    tier: 'courtier',
    criteria: 'Earn Sipahi in a course.',
    description: 'Mountain of light — master of one course.',
  },
  {
    id: 'pundit',
    name: 'Pundit',
    sanskrit: 'पंडित',
    emoji: '📚',
    tier: 'courtier',
    criteria: 'Earn Sipahi in 3 distinct courses.',
    description: 'Scholar — mastery across three subjects.',
  },
  {
    id: 'simha',
    name: 'Simha',
    sanskrit: 'सिंह',
    emoji: '🦁',
    tier: 'courtier',
    criteria: 'Reach 180-day review streak.',
    description: 'Lion — half a year of consistency.',
  },
  // Tier 4 — Royalty
  {
    id: 'rajkumar',
    name: 'Rajkumar / Rajkumari',
    sanskrit: 'राजकुमार',
    emoji: '👑',
    tier: 'royalty',
    criteria: 'Earn all three Tier-3 badges.',
    description: 'Prince / Princess — court is complete.',
  },
  {
    id: 'mantri',
    name: 'Mantri',
    sanskrit: 'मंत्री',
    emoji: '⚖️',
    tier: 'royalty',
    criteria: 'Recover 50+ missed cards across all courses.',
    description: 'Minister — service to the realm.',
  },
  {
    id: 'vikram',
    name: 'Vikram',
    sanskrit: 'विक्रम',
    emoji: '🌟',
    tier: 'royalty',
    criteria: 'Kohinoor in every course + 365-day review streak.',
    description: 'King Vikram — all courses, all year.',
  },
];

export const TIER_2_BADGE_IDS: ReadonlySet<string> = new Set([
  'sipahi',
  'sukh-dukh',
  'vaidya',
]);

export const TIER_3_BADGE_IDS: ReadonlySet<string> = new Set([
  'kohinoor',
  'pundit',
  'simha',
]);

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ── Badge progress ─────────────────────────────────────────────────────────

export function computeBadgeProgress(items: IReviewItem[]): BadgeProgress[] {
  const reviews30d = items.filter(isReviewedInLast30Days);
  // Approximate total review count via n (consecutive correct reviews)
  // since IReviewItem lacks a separate `review_count` field.
  const totalReviews = items.reduce((s, i) => s + (i.n ?? 0), 0);

  const longestStreak = computeLongestStreak(items);
  const currentStreak = computeCurrentStreak(items);
  const retention30d = computeRetention30d(items);
  const recoveredMissed = countRecoveredMissed(items);
  const tier2InCourses = countTier2InDistinctCourses(items);
  const tier3Earned = countTier3Earned(items);

  return BADGE_CATALOGUE.map((badge) => {
    const { current, target, earned } = evaluateBadge(badge.id, {
      totalReviews,
      reviews30dCount: reviews30d.length,
      longestStreak,
      currentStreak,
      retention30d,
      recoveredMissed,
      tier2InCourses,
      tier3Earned,
      courseCount: countDistinctCourses(items),
      longestStreakIs365: longestStreak >= 365,
      kohinoorInEveryCourse: kohinoorInEveryCourse(items),
    });
    return {
      badge,
      earned,
      earnedAt: earned ? new Date() : null,
      progress: { current, target },
    };
  });
}

interface BadgeInputs {
  totalReviews: number;
  reviews30dCount: number;
  longestStreak: number;
  currentStreak: number;
  retention30d: number | null;
  recoveredMissed: number;
  tier2InCourses: number;
  tier3Earned: number;
  courseCount: number;
  longestStreakIs365: boolean;
  kohinoorInEveryCourse: boolean;
}

function evaluateBadge(
  id: string,
  i: BadgeInputs,
): { current: number; target: number; earned: boolean } {
  switch (id) {
    case 'dwarapala':
      return { current: Math.min(i.totalReviews, 10), target: 10, earned: i.totalReviews >= 10 };
    case 'pranam':
      return {
        current: Math.min(i.reviews30dCount, 5),
        target: 5,
        earned: i.reviews30dCount >= 5,
      };
    case 'kanchuki':
      return {
        current: Math.min(i.currentStreak, 7),
        target: 7,
        earned: i.currentStreak >= 7,
      };
    case 'sipahi':
      return {
        current: i.totalReviews,
        target: 20,
        earned: i.totalReviews >= 20 && (i.retention30d ?? 0) >= 80,
      };
    case 'sukh-dukh':
      return {
        current: Math.min(i.recoveredMissed, 1),
        target: 1,
        earned: i.recoveredMissed >= 1,
      };
    case 'vaidya':
      return {
        current: Math.min(i.longestStreak, 90),
        target: 90,
        earned: i.longestStreak >= 90,
      };
    case 'kohinoor':
      return {
        current: i.tier2InCourses,
        target: 1,
        earned: i.tier2InCourses >= 1,
      };
    case 'pundit':
      return {
        current: Math.min(i.tier2InCourses, 3),
        target: 3,
        earned: i.tier2InCourses >= 3,
      };
    case 'simha':
      return {
        current: Math.min(i.longestStreak, 180),
        target: 180,
        earned: i.longestStreak >= 180,
      };
    case 'rajkumar':
      return {
        current: Math.min(i.tier3Earned, 3),
        target: 3,
        earned: i.tier3Earned >= 3,
      };
    case 'mantri':
      return {
        current: Math.min(i.recoveredMissed, 50),
        target: 50,
        earned: i.recoveredMissed >= 50,
      };
    case 'vikram':
      return {
        current: i.courseCount,
        target: i.courseCount,
        earned: i.kohinoorInEveryCourse && i.longestStreakIs365,
      };
    default:
      return { current: 0, target: 0, earned: false };
  }
}

/**
 * Per-badge "unit" for the distance column. Mirrors the criteria text
 * so the mentor-view table reads naturally ("1 review", "4 days",
 * "3 questions", etc.). Keeps service pure-of-controller state.
 */
const BADGE_DISTANCE_UNIT: Record<string, string> = {
  dwarapala: 'review',
  pranam: 'questions',
  kanchuki: 'streak-days',
  sipahi: 'reviews',
  'sukh-dukh': 'unsure-answers',
  vaidya: 'recovered-cards',
  kohinoor: 'sipahi-courses',
  pundit: 'sipahi-courses',
  simha: 'streak-days',
  rajkumar: 'tier-3-badges',
  mantri: 'recovered-cards',
  vikram: 'kohinoor-courses',
};

/**
 * Tier precedence for tie-breaking (lower index = wins ties).
 * Entry tier is closest-to-earned; royalty is the hardest.
 */
const TIER_PRECEDENCE: Record<string, number> = {
  entry: 0,
  apprentice: 1,
  courtier: 2,
  royalty: 3,
};

/**
 * For one student, return their single closest unearned badge.
 * Returns `null` if all 12 badges are already earned.
 *
 * "Closest" = smallest `target - current`. Tie-break by tier
 * (entry first), then alphabetic `badgeId`.
 *
 * `studentId`/`studentName` are left blank — the caller fills them
 * in (service stays student-agnostic).
 */
export function computeNextBadgeProximity(
  items: IReviewItem[],
): NextBadgeProximity | null {
  const progress = computeBadgeProgress(items);
  // Filter earned + Vikram-style 0-distance cases (current === target but
  // not yet earned — Vikram is the only one in the catalogue that has
  // this shape: `current = target = courseCount`).
  const unearned = progress.filter(
    (p) => !p.earned && p.progress.target - p.progress.current > 0,
  );
  if (unearned.length === 0) return null;
  return pickClosestBadge(unearned);
}

function pickClosestBadge(
  badges: BadgeProgress[],
): NextBadgeProximity | null {
  if (badges.length === 0) return null;

  // Decorate with distance; > 0 guaranteed by caller filter.
  const decorated = badges.map((b) => ({
    badge: b.badge,
    distance: Math.max(0, b.progress.target - b.progress.current),
  }));

  decorated.sort((a, b) => {
    // 1. Smaller distance wins.
    if (a.distance !== b.distance) return a.distance - b.distance;
    // 2. Tie-break by tier precedence (entry first).
    const tA = TIER_PRECEDENCE[a.badge.tier] ?? 99;
    const tB = TIER_PRECEDENCE[b.badge.tier] ?? 99;
    if (tA !== tB) return tA - tB;
    // 3. Final tie-break: alphabetic badge id.
    return a.badge.id.localeCompare(b.badge.id);
  });

  const winner = decorated[0];
  return {
    studentId: '', // controller fills in
    studentName: '', // controller fills in
    badgeId: winner.badge.id,
    badgeName: winner.badge.name,
    distance: winner.distance,
    unit: BADGE_DISTANCE_UNIT[winner.badge.id] ?? 'units',
  };
}

// ── Status snapshots ───────────────────────────────────────────────────────

export function computeStatusSnapshots(
  items: IReviewItem[],
): StatusSnapshot[] {
  const allTime = computeStatusValues(items, null);
  const last30 = computeStatusValues(items, 30 * MS_PER_DAY);
  const order: StatusMetric[] = [
    'retention',
    'streak',
    'ef_stability',
    'volume',
    'stuck_cards',
  ];
  return order.map((metric) => ({
    metric,
    allTime: allTime[metric],
    last30Days: last30[metric],
  }));
}

function computeStatusValues(
  items: IReviewItem[],
  windowMs: number | null,
): Record<StatusMetric, StatusValue> {
  const inWindow =
    windowMs === null
      ? items
      : items.filter((i) => isReviewedInWindow(i, windowMs));

  const retention = computeRetention(inWindow);
  const streak = computeStreakInWindow(items, windowMs);
  const efStability = computeEFStability(inWindow);
  const volume = inWindow.reduce((s, i) => s + (i.n ?? 0), 0);
  const stuck = inWindow.filter((i) => i.n === 0 && (i.EF ?? 0) > 0 && (i.EF ?? 0) < 2.0).length;

  return {
    retention: { value: Math.round(retention ?? 0), unit: 'percent' },
    streak: { value: streak, unit: 'days' },
    ef_stability: {
      value: Math.round(efStability * 100) / 100,
      unit: 'score',
    },
    volume: { value: volume, unit: 'count' },
    stuck_cards: { value: stuck, unit: 'count' },
  };
}

// ── Streak helpers ─────────────────────────────────────────────────────────

export function computeCurrentStreak(items: IReviewItem[]): number {
  return computeStreakInWindow(items, null);
}

export function computeLongestStreak(items: IReviewItem[]): number {
  if (items.length === 0) return 0;
  const days = uniqueReviewDays(items);
  if (days.length === 0) return 0;
  days.sort((a, b) => a - b);
  let longest = 1;
  let current = 1;
  for (let i = 1; i < days.length; i++) {
    const diff = (days[i] - days[i - 1]) / MS_PER_DAY;
    if (Math.round(diff) === 1) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }
  return longest;
}

function computeStreakInWindow(
  items: IReviewItem[],
  windowMs: number | null,
): number {
  const days = uniqueReviewDays(items, windowMs);
  if (days.length === 0) return 0;
  days.sort((a, b) => a - b);
  const today = startOfDay(new Date()).getTime();
  const last = days[days.length - 1];
  if (today - last > MS_PER_DAY) return 0;
  let streak = 1;
  for (let i = days.length - 2; i >= 0; i--) {
    const diff = (days[i + 1] - days[i]) / MS_PER_DAY;
    if (Math.round(diff) === 1) streak++;
    else break;
  }
  return streak;
}

function uniqueReviewDays(
  items: IReviewItem[],
  windowMs: number | null = null,
): number[] {
  const cutoff = windowMs === null ? 0 : Date.now() - windowMs;
  const set = new Set<number>();
  for (const i of items) {
    const ts = i.last_reviewed_at;
    if (!ts) continue;
    const t = ts instanceof Date ? ts.getTime() : new Date(ts).getTime();
    if (t < cutoff) continue;
    set.add(startOfDay(new Date(t)).getTime());
  }
  return Array.from(set);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// ── Retention ──────────────────────────────────────────────────────────────

/**
 * 30-day retention percentage.
 *
 * Accepts an optional `now?: Date` so the 30-day cutoff is deterministic
 * in tests. Production callers (MotivationController) omit `now`, so the
 * real wall-clock time is used.
 *
 * Implementation note: the filter is inlined as `(i) => ...` rather than
 * passed directly as `items.filter(isReviewedInLast30Days)` because
 * `Array#filter` invokes the callback with `(item, index, array)` — and
 * `isReviewedInLast30Days` only accepts `(item)`. The arrow wrapper
 * ignores the extra args, but using the raw reference would pass `index`
 * (a number) as the second positional arg of any future extension of
 * the helper.
 */
export function computeRetention30d(
  items: IReviewItem[],
  now?: Date,
): number | null {
  if (now === undefined) {
    const w = items.filter(isReviewedInLast30Days);
    return computeRetention(w);
  }
  const cutoffMs = now.getTime() - 30 * MS_PER_DAY;
  const w = items.filter((i) => isReviewedInWindowMs(i, 30 * MS_PER_DAY, cutoffMs));
  return computeRetention(w);
}

function computeRetention(items: IReviewItem[]): number | null {
  if (items.length === 0) return null;
  const sum = items.reduce((s, i) => s + (i.EF ?? 1.3), 0);
  return Math.round(((sum / items.length - 1.3) / (3.0 - 1.3)) * 100);
}

// ── EF stability ───────────────────────────────────────────────────────────

function computeEFStability(items: IReviewItem[]): number {
  if (items.length < 2) return 1;
  const efs = items.map((i) => i.EF ?? 2.5);
  const mean = efs.reduce((s, v) => s + v, 0) / efs.length;
  if (mean === 0) return 0;
  const variance =
    efs.reduce((s, v) => s + (v - mean) * (v - mean), 0) / efs.length;
  const stddev = Math.sqrt(variance);
  const cv = stddev / mean;
  return Math.max(0, Math.min(1, 1 - cv));
}

// ── Coverage / learner category ────────────────────────────────────────────

export function computeLearnerCategory(
  retention30d: number | null,
  coverage: number,
): LearnerCategory {
  const highCov = coverage >= 70;
  const highRet = (retention30d ?? 0) >= 80;
  if (highCov && highRet) return 'all-rounder';
  if (highCov && !highRet) return 'sprinter';
  if (!highCov && highRet) return 'mastery-only';
  return 'quiet';
}

// ── Internal helpers ───────────────────────────────────────────────────────

function isReviewedInLast30Days(item: IReviewItem): boolean {
  return isReviewedInWindow(item, 30 * MS_PER_DAY);
}

function isReviewedInWindow(item: IReviewItem, windowMs: number): boolean {
  return isReviewedInWindowMs(item, windowMs, Date.now());
}

/**
 * Like `isReviewedInWindow` but takes an explicit `nowMs` so tests
 * can pin the cutoff deterministically. Production callers use
 * `isReviewedInWindow(item, windowMs)` which delegates here with
 * `Date.now()`.
 */
function isReviewedInWindowMs(
  item: IReviewItem,
  windowMs: number,
  nowMs: number,
): boolean {
  if (!item.last_reviewed_at) return false;
  const t =
    item.last_reviewed_at instanceof Date
      ? item.last_reviewed_at.getTime()
      : new Date(item.last_reviewed_at).getTime();
  return nowMs - t <= windowMs;
}

function countDistinctCourses(items: IReviewItem[]): number {
  return new Set(items.map((i) => i.course_id).filter(Boolean)).size;
}

function countRecoveredMissed(items: IReviewItem[]): number {
  // A "recovered missed card" is one where EF has risen back above
  // 2.0 after a sub-2.0 dip. Pure SM-2 state doesn't track the dip,
  // so we approximate via "EF ≥ 2.0 with n ≥ 2" — this counts items
  // the student has successfully answered at least twice.
  return items.filter((i) => (i.EF ?? 0) >= 2.0 && (i.n ?? 0) >= 2).length;
}

function countTier2InDistinctCourses(items: IReviewItem[]): number {
  // Simplified: count distinct courses with at least one item at
  // Sipahi-equivalent (EF ≥ 2.5 with n ≥ 5).
  const coursesWithSipahi = new Set<string>();
  for (const i of items) {
    if (!i.course_id) continue;
    if ((i.EF ?? 0) >= 2.5 && (i.n ?? 0) >= 5) {
      coursesWithSipahi.add(i.course_id);
    }
  }
  return coursesWithSipahi.size;
}

function countTier3Earned(items: IReviewItem[]): number {
  const longest = computeLongestStreak(items);
  const coursesWithSipahi = countTier2InDistinctCourses(items);
  const simha = longest >= 180;
  const kohinoor = coursesWithSipahi >= 1;
  const pundit = coursesWithSipahi >= 3;
  return [simha, kohinoor, pundit].filter(Boolean).length;
}

function kohinoorInEveryCourse(items: IReviewItem[]): boolean {
  const total = countDistinctCourses(items);
  if (total === 0) return false;
  return countTier2InDistinctCourses(items) === total;
}

// ── Catalogue helpers ──────────────────────────────────────────────────────

export function getBadgesByTier(): Record<BadgeTier, Badge[]> {
  const out: Record<BadgeTier, Badge[]> = {
    entry: [],
    apprentice: [],
    courtier: [],
    royalty: [],
  };
  for (const b of BADGE_CATALOGUE) out[b.tier].push(b);
  return out;
}

export function getBadgeById(id: string): Badge | undefined {
  return BADGE_CATALOGUE.find((b) => b.id === id);
}

// ── Pillar 3: opt-out eligibility ──────────────────────────────────────────

/**
 * Pure computation of whether a student is eligible to opt out of a
 * course's leaderboard, given their flat list of `IReviewItem` for
 * that course.
 *
 * Per `PLAN_MOTIVATION_SYSTEM.md`:
 *   "Opt-out available if 30-day retention ≥ 90% AND reviews in 30-day
 *    window ≥ 100."
 *
 * Re-evaluated on every PATCH call (server-side, fresh computation).
 * Sticky opt-out: dropping below the bar after opting out does NOT
 * auto-rejoin — the gate is at opt-in time only.
 *
 * Default-on for new students: if the student has no review_items
 * for this course (no retention data), they are not eligible because
 * the spec says they "cannot opt out" until they meet the threshold.
 * The `reviews30d >= 100` check naturally covers this — zero reviews
 * is below the bar.
 *
 * @returns { eligible: true } if both gates pass; { eligible: false,
 *   reason: string } otherwise. The reason is a human-readable string
 *   the controller surfaces in the 403 message.
 *
 * Note: pure on the input list — no `Date.now()` so tests are
 * deterministic. The caller passes `now` explicitly so the window
 * is stable.
 */
export function evaluateOptOutEligibility(
  items: IReviewItem[],
  now: Date = new Date(),
): { eligible: true } | { eligible: false; reason: string } {
  const cutoff = new Date(now.getTime() - 30 * MS_PER_DAY);

  // 30-day review count: items whose `last_reviewed_at` is in the
  // window. Mirrors the spaced-repetition cron's day-window math.
  const reviewsLast30d = items.filter((i) => {
    if (!i.last_reviewed_at) return false;
    const t =
      i.last_reviewed_at instanceof Date
        ? i.last_reviewed_at.getTime()
        : new Date(i.last_reviewed_at).getTime();
    return t >= cutoff.getTime();
  }).length;

  if (reviewsLast30d < 100) {
    return {
      eligible: false,
      reason: `Need at least 100 reviews in the last 30 days (currently ${reviewsLast30d})`,
    };
  }

  const retention30d = computeRetention30d(items, now);
  if (retention30d === null || retention30d < 90) {
    return {
      eligible: false,
      reason: `Need 30-day retention ≥ 90% (currently ${retention30d ?? 0}%)`,
    };
  }

  return { eligible: true };
}
