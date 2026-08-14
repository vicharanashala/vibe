import { IUserRepository } from '#root/shared/database/interfaces/IUserRepository.js';
import { ProgressRepository } from '#root/shared/database/providers/mongo/repositories/ProgressRepository.js';
import { StreakResponse } from '../classes/dtos/StreakResponse.js';
import { USERS_TYPES } from '../types.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { injectable, inject } from 'inversify';

/**
 * Day-count thresholds that unlock an achievement celebration. When a learner's
 * current streak crosses one of these, a `newlyUnlockedMilestone` is returned
 * (and immediately acknowledged server-side) so the dashboard can show a toast.
 * The ring/banner derive progress from the same list.
 */
export const STREAK_MILESTONES = [3, 7, 15, 30, 90, 100] as const;

function dayKey(date: Date): string {
  const y = date.getUTCFullYear().toString().padStart(4, '0');
  const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = date.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Consecutive-day count ending today (or yesterday if today has no activity yet,
 * giving the learner the current day to keep the streak alive).
 */
function computeCurrentStreak(activeDays: Set<string>, now: Date): number {
  let cursor = new Date(now);
  if (!activeDays.has(dayKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  let streak = 0;
  while (activeDays.has(dayKey(cursor))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

/** Longest run of consecutive days in the (sorted, UTC) active-day list. */
function computeLongestStreak(activeDays: string[]): number {
  let longest = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of activeDays) {
    const current = new Date(`${key}T00:00:00Z`);
    if (
      prev &&
      current.getTime() - prev.getTime() === 24 * 60 * 60 * 1000
    ) {
      run++;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prev = current;
  }
  return longest;
}

@injectable()
export class StreakService {
  constructor(
    @inject(USERS_TYPES.ProgressRepo)
    private readonly progressRepo: ProgressRepository,
    @inject(GLOBAL_TYPES.UserRepo)
    private readonly userRepo: IUserRepository,
  ) {}

  /**
   * Computes the learner's streak on demand (no cron). Everything is derived
   * from a single distinct-day set, so the ring, banner, and toast all agree.
   *
   * Side effect: any milestone newly crossed is written back to the user and
   * returned as `newlyUnlockedMilestones` exactly once per milestone.
   */
  async getStreak(userId: string): Promise<StreakResponse> {
    const [activeDays, acknowledged] = await Promise.all([
      this.progressRepo.getActiveDaySet(userId),
      this.userRepo.getAcknowledgedStreakMilestones(userId),
    ]);

    const activeSet = new Set(activeDays);
    const isActiveToday = activeSet.has(dayKey(new Date()));

    const currentStreak = computeCurrentStreak(activeSet, new Date());
    const longestStreak = computeLongestStreak(activeDays);

    const newlyUnlockedMilestones = STREAK_MILESTONES.filter(
      m => m <= currentStreak && !acknowledged.includes(m),
    );
    if (newlyUnlockedMilestones.length > 0) {
      await this.userRepo.acknowledgeStreakMilestones(
        userId,
        newlyUnlockedMilestones,
      );
    }

    const nextMilestone =
      STREAK_MILESTONES.find(m => m > currentStreak) ?? null;
    const progressToNext = nextMilestone
      ? Math.min(1, currentStreak / nextMilestone)
      : 1;

    return {
      currentStreak,
      longestStreak,
      isActiveToday,
      lastActiveDate: activeDays[activeDays.length - 1] ?? null,
      nextMilestone,
      progressToNext,
      newlyUnlockedMilestones,
    };
  }
}
