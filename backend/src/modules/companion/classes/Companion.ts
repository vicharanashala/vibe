import {CompanionAnimal, GrowthStage, CompanionMood, ICompanion} from './interfaces.js';

/**
 * Companion domain entity.
 * Stored in MongoDB as `{userId, animal, lastActiveAt, createdAt}`.
 *
 * Growth stage and mood are computed server-side at read time from
 * live ViBe data — they are NEVER persisted.
 */
class Companion {
  constructor(
    public readonly userId: string,
    public readonly animal: CompanionAnimal,
    public readonly lastActiveAt: Date,
    public readonly createdAt: Date,
  ) {}

  /** Build a full ICompanion response by enriching with live ViBe data */
  toJSON(live: {
    realProgress: number;
    realQuizScore: number;
    idleDays: number;
    stage: GrowthStage;
    mood: CompanionMood;
  }): ICompanion {
    return {
      userId: this.userId,
      animal: this.animal,
      realProgress: live.realProgress,
      realQuizScore: live.realQuizScore,
      idleDays: live.idleDays,
      stage: live.stage,
      mood: live.mood,
      lastActiveAt: this.lastActiveAt,
      createdAt: this.createdAt,
    };
  }
}

export {Companion};