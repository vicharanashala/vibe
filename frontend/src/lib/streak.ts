// ── Review streak (added 2026-08-03) ────────────────────────────────────────────────
// Lightweight per-student "consecutive review days" counter. Persists to
// localStorage only (no backend dependency).
//
// SEMANTICS (clarified 2026-08-03 after Emie asked "what if the student
// doesn't have review sessions on a particular day?"):
//   The streak counts CONSECUTIVE CALENDAR DAYS (Asia/Kolkata) on which
//   at least one review was completed. Skipping a day entirely RESETS the
//   streak to 1 on the next review.
//
//   Edge cases:
//   - First review ever → count = 1.
//   - Same calendar day → unchanged.
//   - Exactly +1 calendar day → count + 1.
//   - Gap of 2+ days → reset to 1.
//
//   This is the strict Duolingo / GitHub-contributions interpretation.
//   Emie noted (2026-08-03) that this could feel punishing to a student
//   who has mastered all cards and has nothing due for two weeks — they'd
//   "lose" their streak without ever missing a reviewable item. That
//   forgiving variant (only reset if a due card went untouched) would
//   require coupling the streak to the schedule, which this file is not
//   designed to do (and which would require a backend endpoint). For the
//   current demo, strict semantics are fine; revisit if/when a student
//   retention complaint comes in.
//
// Design choices:
// - Date-only keys (YYYY-MM-DD in Asia/Kolkata) — not timestamps. A student
//   reviewing at 11:55 PM and then again at 12:05 AM next day counts as
//   2 consecutive days, never a reset.
// - Pure functions take optional `clock` and `storage` params for testability
//   without a test framework. Frontend has no vitest setup; the runtime
//   behavior is verified via a one-shot node probe (see git history for
//   `scripts/.trash/streak-probe-*.txt` archives).
// - Fail-open: if localStorage is unavailable (private browsing on some
//   browsers, SSR), the streak simply doesn't update. No error is thrown.

const STORAGE_KEY = 'vibe_sr_streak_v1';
const TIMEZONE = 'Asia/Kolkata'; // ViBe is built for Indian student communities.

/** Default wall clock: `() => new Date()`. Injectable for tests. */
export type Clock = () => Date;

/** Default storage: `window.localStorage`. Injectable for tests. */
export interface StreakStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const defaultStorage: StreakStorage | null =
  typeof window !== 'undefined' && window.localStorage
    ? window.localStorage
    : null;

const defaultClock: Clock = () => new Date();

/**
 * Returns today's date as `YYYY-MM-DD` in the ViBe timezone (Asia/Kolkata),
 * using the supplied `clock` so tests can pin time.
 */
export function getTodayKey(clock: Clock = defaultClock): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // en-CA formats as YYYY-MM-DD natively. e.g. "2026-08-03".
  return fmt.format(clock());
}

/**
 * `true` if `todayKey` is exactly the calendar day after `prevKey`. Both
 * arguments are `YYYY-MM-DD` strings. The strings are parsed via the
 * Date constructor (UTC midnight) so day arithmetic is unambiguous.
 */
export function isYesterday(prevKey: string, todayKey: string): boolean {
  const prev = new Date(`${prevKey}T00:00:00Z`).getTime();
  const today = new Date(`${todayKey}T00:00:00Z`).getTime();
  // 24 hours × 60 minutes × 60 seconds × 1000 ms. DST doesn't apply in UTC.
  const oneDayMs = 24 * 60 * 60 * 1000;
  return today - prev === oneDayMs;
}

export interface StreakState {
  /** Consecutive review-day count. 0 means no reviews yet today. */
  count: number;
  /** `YYYY-MM-DD` of the most recent review, or `null` if no reviews yet. */
  lastDate: string | null;
}

/**
 * Read the current streak from storage. Returns `{ count: 0, lastDate: null }`
 * when no prior review exists or storage is unavailable.
 */
export function loadStreak(storage: StreakStorage | null = defaultStorage): StreakState {
  if (!storage) return { count: 0, lastDate: null };
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return { count: 0, lastDate: null };
  try {
    const parsed = JSON.parse(raw) as Partial<StreakState>;
    if (
      typeof parsed.count === 'number' &&
      typeof parsed.lastDate === 'string'
    ) {
      return { count: parsed.count, lastDate: parsed.lastDate };
    }
  } catch {
    // Corrupted entry — treat as fresh. No throw, no console.error: localStorage
    // corruption is recoverable and not worth alarming the student.
  }
  return { count: 0, lastDate: null };
}

/**
 * Record a review completed at "now" (per `clock`). Updates the streak per
 * the consecutive-day rule and persists. Returns the new state.
 *
 * Rules:
 * - First review ever → `count: 1`, `lastDate: today`.
 * - Second review same day → unchanged.
 * - Review exactly one day later → `count + 1`.
 * - Review more than one day later → reset to `1`.
 *
 * Fail-open: if `storage` is `null`, returns the in-memory computed state
 * without persisting. Caller can use the returned value to update UI state.
 */
export function recordReviewToday(
  clock: Clock = defaultClock,
  storage: StreakStorage | null = defaultStorage,
): StreakState {
  const todayKey = getTodayKey(clock);
  const prior = loadStreak(storage);

  let nextCount: number;
  if (prior.lastDate === null) {
    nextCount = 1;
  } else if (prior.lastDate === todayKey) {
    nextCount = prior.count; // same day, no change
  } else if (isYesterday(prior.lastDate, todayKey)) {
    nextCount = prior.count + 1;
  } else {
    nextCount = 1; // gap of 2+ days → reset
  }

  const next: StreakState = { count: nextCount, lastDate: todayKey };

  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Quota exceeded or storage disabled — fail open. Streak still updates
      // in the caller's local state for this session; just won't survive reload.
    }
  }

  return next;
}

/** Clear the streak (used by the demo "Reset Mock State" button). */
export function clearStreak(storage: StreakStorage | null = defaultStorage): void {
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // fail open
  }
}