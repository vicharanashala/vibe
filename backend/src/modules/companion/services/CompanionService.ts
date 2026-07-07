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

    const [liveProgress, liveQuizScore, daysSinceEnrollment] = await Promise.all([
      this._getRealProgress(userId),
      this._getRealQuizScore(userId),
      this._daysSinceEnrollment(userId),
    ]);

    const stage = this._computeStage(liveProgress);
    const mood = this._deriveMood(liveProgress, daysSinceEnrollment);

    return companion.toJSON({realProgress: liveProgress, realQuizScore: liveQuizScore, idleDays: daysSinceEnrollment, stage, mood});
  }

  /**
   * Select (or change) the companion animal for a student.
   * Returns the full companion state after selection.
   */
  async selectAnimal(userId: string, animal: CompanionAnimal): Promise<ICompanion> {
    const companion = await this.companionRepo.upsert(userId, animal);
    const [liveProgress, liveQuizScore, daysSinceEnrollment] = await Promise.all([
      this._getRealProgress(userId),
      this._getRealQuizScore(userId),
      this._daysSinceEnrollment(userId),
    ]);
    const stage = this._computeStage(liveProgress);
    const mood = this._deriveMood(liveProgress, daysSinceEnrollment);
    return companion.toJSON({realProgress: liveProgress, realQuizScore: liveQuizScore, idleDays: daysSinceEnrollment, stage, mood});
  }

  // ─── Live data read methods ──────────────────────────────────────────────

  /**
   * Get overall course progress for a student.
   * Returns the highest percentCompleted across all active enrollments.
   * Falls back to 0 if no enrollment exists.
   */
  private async _getRealProgress(userId: string): Promise<number> {
    try {
      // Page through enough enrollments to find the highest active one. Without
      // pagination, a student enrolled in 12+ courses would have their oldest
      // entries silently dropped, and the 'highest' calculation would be wrong.
      const PAGE_SIZE = 100;
      let skip = 0;
      let highest = 0;
      while (true) {
        // EnrollmentRepository.getEnrollments returns the enrollment docs
        // directly (an array), not {enrollments, totalDocuments}. Earlier
        // code here read `result.enrollments` which was always undefined and
        // meant the companion never actually reflected real progress.
        const page = (await this.enrollmentRepo.getEnrollments(
          userId,
          skip,
          PAGE_SIZE,
          '',
          'STUDENT',
        )) as unknown as Array<{percentCompleted?: number}>;
        if (!Array.isArray(page) || page.length === 0) break;
        for (const e of page) {
          const pct = e.percentCompleted ?? 0;
          if (pct < 100 && pct > highest) highest = pct;
        }
        if (page.length < PAGE_SIZE) break;
        skip += PAGE_SIZE;
      }
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
      // Submission records store userId as either a hex string or an ObjectId
      // (see SubmissionRepository.get). Match both shapes to be safe — otherwise
      // a string-stored userId would cause ObjectId() to throw inside $match.
      const userIdStr = String(userId);
      const userIdObj = ObjectId.isValid(userIdStr) ? new ObjectId(userIdStr) : null;
      const userIdMatch = userIdObj
        ? {$in: [userIdStr, userIdObj]}
        : userIdStr;
      const result = await (submissionsCollection as Collection)
        .aggregate([
          {
            $match: {
              userId: userIdMatch,
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
   * Days since the student's first enrollment date.
   *
   * NOTE: this is a misnomer that survived from the prototype. It really
   * measures "account age as a student", NOT activity — a learner who enrolled
   * two years ago and just finished a lesson today will read as `idle=730`.
   * Wiring it to true last-activity time is tracked separately; for now the
   * name is changed to make the semantic clear at the call site.
   *
   * TODO: replace with `lastActiveAt` from the user's session log once that
   * signal is exposed by the auth service.
   */
  private async _daysSinceEnrollment(userId: string): Promise<number> {
    try {
      // getEnrollments returns the array directly (see _getRealProgress comment).
      const page = (await this.enrollmentRepo.getEnrollments(
        userId, 0, 1, '', 'STUDENT',
      )) as unknown as Array<{enrollmentDate?: Date}>;
      const enrollment = Array.isArray(page) ? page[0] : undefined;
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