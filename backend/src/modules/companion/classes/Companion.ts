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

  /**
   * Build a full ICompanion response by enriching with live ViBe data.
   * studying is NOT set here — it is a live signal pushed by the frontend.
   */
  toJSON(live: {
    realProgress: number;
    quizScore: number;
    idleDays: number;
    stage: GrowthStage;
    mood: CompanionMood;
    graduationCap: boolean;
    studying: boolean;
    newJourney: boolean;
  }): ICompanion {
    return {
      userId: this.userId,
      animal: this.animal,
      realProgress: live.realProgress,
      quizScore: live.quizScore,
      idleDays: live.idleDays,
      stage: live.stage,
      mood: live.mood,
      studying: live.studying,
      graduationCap: live.graduationCap,
      lastActiveAt: this.lastActiveAt,
      createdAt: this.createdAt,
      newJourney: live.newJourney,
    };
  }
}

export {Companion};