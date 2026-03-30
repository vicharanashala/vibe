import {ClientSession} from 'mongodb';
import {IAchievement, IUserAchievement} from '#root/shared/interfaces/models.js';

export interface IUserAchievementWithDetails extends IUserAchievement {
  achievement: IAchievement;
}

export interface IAchievementRepository {
  // ── Definitions ──────────────────────────────────────────────────
  findAll(): Promise<IAchievement[]>;
  findBySlug(slug: string): Promise<IAchievement | null>;
  seedDefinitions(definitions: Omit<IAchievement, '_id'>[]): Promise<void>;

  // ── User Achievements ─────────────────────────────────────────────
  createUserAchievement(
    record: Omit<IUserAchievement, '_id'>,
    session?: ClientSession,
  ): Promise<string>;
  findUserAchievements(userId: string): Promise<IUserAchievementWithDetails[]>;
  findEarnedSlugs(userId: string): Promise<string[]>;
  deleteUserAchievements(userId: string): Promise<void>;

  // ── Progress Query ────────────────────────────────────────────────
  countCompletedCourses(userId: string): Promise<number>;
}
