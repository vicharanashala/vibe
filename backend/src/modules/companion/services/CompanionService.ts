import {COMPANION_TYPES} from '../types.js';
import {CompanionRepository} from '../repositories/providers/mongodb/CompanionRepository.js';
import {
  CompanionAnimal,
  GrowthStage,
  CompanionMood,
  ICompanion,
} from '../classes/interfaces.js';
import {Companion} from '../classes/Companion.js';
import {MongoDatabase} from '#shared/database/providers/mongo/MongoDatabase.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {
  EnrollmentRepository,
} from '#shared/database/providers/mongo/repositories/EnrollmentRepository.js';
import {injectable, inject} from 'inversify';
import {Collection, ObjectId} from 'mongodb';

@injectable()
class CompanionService {
  constructor(
    @inject(GLOBAL_TYPES.Database)
    private readonly db: MongoDatabase,

    @inject(COMPANION_TYPES.CompanionRepo)
    private companionRepo: CompanionRepository,

    @inject(GLOBAL_TYPES.EnrollmentRepo)
    private enrollmentRepo: EnrollmentRepository,
  ) {}

  // ─── Public API ──────────────────────────────────────────────────────────

  /**
   * Get the companion state for a student, enriched with live ViBe data.
   * Returns null if the student hasn't selected an animal yet.
   */
  async getCompanionState(userId: string): Promise<ICompanion | null> {
    const companion = await this.companionRepo.getByUserId(userId);
    if (!companion) return null;

    const [liveProgress, liveQuizScore, idleDays] = await Promise.all([
      this._getRealProgress(userId),
      this._getRealQuizScore(userId),
      this._getIdleDays(userId),
    ]);

    const stage = this._computeStage(liveProgress);
    const mood = this._deriveMood(liveProgress, idleDays);

    return companion.toJSON({realProgress: liveProgress, realQuizScore: liveQuizScore, idleDays, stage, mood});
  }

  /**
   * Select (or change) the companion animal for a student.
   * Returns the full companion state after selection.
   */
  async selectAnimal(userId: string, animal: CompanionAnimal): Promise<ICompanion> {
    const companion = await this.companionRepo.upsert(userId, animal);
    const [liveProgress, liveQuizScore, idleDays] = await Promise.all([
      this._getRealProgress(userId),
      this._getRealQuizScore(userId),
      this._getIdleDays(userId),
    ]);
    const stage = this._computeStage(liveProgress);
    const mood = this._deriveMood(liveProgress, idleDays);
    return companion.toJSON({realProgress: liveProgress, realQuizScore: liveQuizScore, idleDays, stage, mood});
  }

  // ─── Live data read methods ──────────────────────────────────────────────

  /**
   * Get overall course progress for a student.
   * Returns the highest percentCompleted across all active enrollments.
   * Falls back to 0 if no enrollment exists.
   */
  private async _getRealProgress(userId: string): Promise<number> {
    try {
      const result = await this.enrollmentRepo.getEnrollments(
        userId,
        0,       // skip
        10,      // limit — get top 10 active enrollments
        '',      // search
        'STUDENT',
      ) as any;
      const enrollments = (result?.enrollments ?? []) as Array<{percentCompleted?: number}>;
      if (enrollments.length === 0) return 0;
      // Return the highest progress across all courses
      const highest = Math.max(...enrollments.map(e => e.percentCompleted ?? 0));
      return Math.min(100, highest);
    } catch {
      return 0;
    }
  }

  /**
   * Compute average quiz score across all submitted quizzes for a student.
   * Uses an aggregation on the submission_results collection directly,
   * counting only submissions that have a gradingResult.totalScore.
   * Falls back to 0 if no scored submissions exist.
   */
  private async _getRealQuizScore(userId: string): Promise<number> {
    try {
      const submissionsCollection = await this.db.getCollection('quiz_submission_results');
      const result = await (submissionsCollection as Collection)
        .aggregate([
          {
            $match: {
              userId: new ObjectId(userId),
              'gradingResult.totalScore': {$exists: true, $ne: null},
            },
          },
          {
            $group: {
              _id: null,
              avgScore: {$avg: '$gradingResult.totalScore'},
            },
          },
        ])
        .toArray();

      if (!result || result.length === 0) return 0;
      return Math.round(result[0].avgScore ?? 0);
    } catch {
      return 0;
    }
  }

  /**
   * Days since the student's last enrollment date.
   * (Enrollment date = when they first enrolled, so it's a proxy for activity age.)
   */
  private async _getIdleDays(userId: string): Promise<number> {
    try {
      const result = await this.enrollmentRepo.getEnrollments(
        userId, 0, 1, '', 'STUDENT',
      ) as any;
      const enrollment = (result?.enrollments ?? [])[0] as
        | {enrollmentDate?: Date}
        | undefined;
      if (!enrollment?.enrollmentDate) return 0;
      const msPerDay = 1000 * 60 * 60 * 24;
      const diffMs = Date.now() - new Date(enrollment.enrollmentDate).getTime();
      return Math.max(0, Math.floor(diffMs / msPerDay));
    } catch {
      return 0;
    }
  }

  // ─── Growth & mood derivation ────────────────────────────────────────────

  /**
   * Stage from progress — maps 0-100 to stages 0-5.
   * Thresholds: [0, 20, 45, 70, 90, 100]
   *
   * Stage 5 (fully grown) requires completion — not just progress.
   * This way "near the end" feels different from "done".
   */
  private _computeStage(progress: number): GrowthStage {
    if (progress < 20) return 0;
    if (progress < 45) return 1;
    if (progress < 70) return 2;
    if (progress < 90) return 3;
    if (progress < 100) return 4;
    return 5;
  }

  /**
   * Derive mood from real progress + idle days.
   * Follows review-not-punish policy — idle triggers gentle states, not anger.
   *
   * Logic:
   *   idle > 7 days  → sleeping  (companion is waiting, not upset)
   *   idle 3-7 days  → worried   (gentle nudge, not harsh)
   *   idle < 3 days  → based on progress:
   *     100%         → celebrating
   *     70-99%       → excited
   *     40-69%       → studying
   *     0-39%        → neutral
   */
  private _deriveMood(progress: number, idleDays: number): CompanionMood {
    if (idleDays > 7) return 'sleeping';
    if (idleDays >= 3) return 'worried';

    if (progress === 100) return 'excited';
    if (progress >= 70) return 'happy';
    if (progress >= 40) return 'studying';
    return 'neutral';
  }
}

export {CompanionService};