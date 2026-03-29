import 'reflect-metadata';
import {injectable, inject} from 'inversify';
import {ObjectId, ClientSession} from 'mongodb';
import {ACHIEVEMENTS_TYPES} from '../types.js';
import {AchievementRepository} from '../repositories/AchievementRepository.js';
import {IAchievementRepository} from '../interfaces/IAchievementRepository.js';
import {ACHIEVEMENT_DEFINITIONS} from '../seeds/achievementDefinitions.js';
import {NOTIFICATIONS_TYPES} from '#root/modules/notifications/types.js';
import {NotificationService} from '#root/modules/notifications/services/NotificationService.js';
import {IAchievement, IUserAchievement} from '#root/shared/interfaces/models.js';

@injectable()
export class AchievementService {
  constructor(
    @inject(ACHIEVEMENTS_TYPES.AchievementRepo)
    private readonly repo: IAchievementRepository,
    @inject(NOTIFICATIONS_TYPES.NotificationService)
    private readonly notificationService: NotificationService,
  ) {}

  // ── Seed ───────────────────────────────────────────────────────────────────

  async seedAchievements(): Promise<void> {
    await this.repo.seedDefinitions(ACHIEVEMENT_DEFINITIONS);
    console.log('✅ Achievement definitions seeded');
  }

  // ── Core: Check & Award ────────────────────────────────────────────────────

  /**
   * Called whenever a course is marked complete for a user.
   * Idempotent — safe to call multiple times for the same user.
   * The unique DB index on (userId, achievementId) prevents duplicates.
   */
  async checkAndAward(userId: string): Promise<void> {
    const [completedCount, allDefinitions, earnedSlugs] = await Promise.all([
      this.repo.countCompletedCourses(userId),
      this.repo.findAll(),
      this.repo.findEarnedSlugs(userId),
    ]);

    const earnedSet = new Set(earnedSlugs);

    const toAward = allDefinitions.filter(
      def =>
        def.requiredCourseCount <= completedCount && !earnedSet.has(def.slug),
    );

    if (!toAward.length) return;

    for (const achievement of toAward) {
      try {
        await this.repo.createUserAchievement({
          userId: new ObjectId(userId),
          achievementId: new ObjectId(achievement._id!.toString()),
          earnedAt: new Date(),
          courseCompletionCountAtTime: completedCount,
        });

        await this.notificationService.notifyAchievementEarned(
          userId,
          achievement.title,
          achievement.tier,
        );
      } catch (err: any) {
        // Unique index violation (11000) = already awarded — safe to ignore.
        // Any other error is logged but must NOT crash the calling flow.
        if (err?.code !== 11000) {
          console.error(
            `[AchievementService] Failed to award "${achievement.slug}" to user ${userId}:`,
            err?.message,
          );
        }
      }
    }
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  async getAllDefinitions(): Promise<IAchievement[]> {
    return this.repo.findAll();
  }

  /**
   * Returns all achievement definitions merged with the user's earned status.
   */
  async getAchievementsForUser(userId: string): Promise<
    (IAchievement & {earned: boolean; earnedAt: Date | null})[]
  > {
    const [allDefinitions, earnedRecords] = await Promise.all([
      this.repo.findAll(),
      this.repo.findUserAchievements(userId),
    ]);

    const earnedMap = new Map(
      earnedRecords.map(r => [
        r.achievement.slug,
        r.earnedAt,
      ]),
    );

    return allDefinitions.map(def => ({
      ...def,
      earned: earnedMap.has(def.slug),
      earnedAt: earnedMap.get(def.slug) ?? null,
    }));
  }

  async getUserEarnedAchievements(userId: string) {
    return this.repo.findUserAchievements(userId);
  }

  /** Dev/test only — directly awards every achievement to the given user. */
  async devSeedForUser(userId: string): Promise<void> {
    const allDefinitions = await this.repo.findAll();
    for (const achievement of allDefinitions) {
      try {
        await this.repo.createUserAchievement({
          userId: new ObjectId(userId),
          achievementId: new ObjectId(achievement._id!.toString()),
          earnedAt: new Date(),
          courseCompletionCountAtTime: achievement.requiredCourseCount,
        });
      } catch (err: any) {
        if (err?.code !== 11000) throw err; // ignore duplicate key
      }
    }
  }
}
