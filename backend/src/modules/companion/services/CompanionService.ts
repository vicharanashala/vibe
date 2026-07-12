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

    const [liveProgress, latestQuizScore, idleDays, studyingAt] = await Promise.all([
      this._getRealProgress(userId),
      this._getLatestQuizScore(userId),
      this._daysSinceLastActivity(userId),
      this.companionRepo.getStudyingAt(userId),
    ]);

    const stage = this._computeStage(liveProgress);
    // studying is live: mood=studying when studyingAt is fresh (< 5 min), else derive
    const isStudying = studyingAt instanceof Date && !Number.isNaN(studyingAt.getTime());
    const mood = isStudying ? 'studying' : this._deriveMood(liveProgress, idleDays);
    const graduationCap = latestQuizScore > 85;

    // Update lastKnownProgress and detect new journey (≥20-point drop)
    const newJourney = await this.companionRepo.updateProgressMeta(userId, liveProgress);

    return companion.toJSON({realProgress: liveProgress, quizScore: latestQuizScore, idleDays, stage, mood, graduationCap, studying: isStudying, newJourney});
  }

  /**
   * Select (or change) the companion animal for a student.
   * Returns the full companion state after selection.
   */
  async selectAnimal(userId: string, animal: CompanionAnimal): Promise<ICompanion> {
    const companion = await this.companionRepo.upsert(userId, animal);
    const [liveProgress, latestQuizScore, idleDays, studyingAt] = await Promise.all([
      this._getRealProgress(userId),
      this._getLatestQuizScore(userId),
      this._daysSinceLastActivity(userId),
      this.companionRepo.getStudyingAt(userId),
    ]);
    const stage = this._computeStage(liveProgress);
    const isStudying = studyingAt instanceof Date && !Number.isNaN(studyingAt.getTime());
    const mood = isStudying ? 'studying' : this._deriveMood(liveProgress, idleDays);
    const graduationCap = latestQuizScore > 85;
    // Update lastKnownProgress and detect new journey (≥20-point drop)
    const newJourney = await this.companionRepo.updateProgressMeta(userId, liveProgress);
    return companion.toJSON({realProgress: liveProgress, quizScore: latestQuizScore, idleDays, stage, mood, graduationCap, studying: isStudying, newJourney});
  }

  /**
   * Push the studying live signal for a student.
   * studying = true  → bumps studyingAt timestamp (refreshes the 5-min TTL)
   * studying = false → clears studyingAt immediately
   *
   * The TTL index on studyingAt means a stale timestamp auto-expires within
   * 5 minutes even if the frontend never sends studying=false (e.g. tab crash).
   */
  async setStudying(userId: string, studying: boolean): Promise<void> {
    await this.companionRepo.setStudyingAt(userId, studying);
  }

  /** Clear the newJourney flag after frontend has shown the one-shot message */
  async clearNewJourney(userId: string): Promise<void> {
    await this.companionRepo.clearNewJourney(userId);
  }

  // ─── Live data read methods ──────────────────────────────────────────────

  /**
   * Get overall course progress for a student.
   * Returns the AVERAGE percentCompleted across **every** enrollment
   * record for the user, rounded to the nearest integer — including
   * enrollments that have moved to the "Completed" section in the UI.
   *
   * IMPORTANT: this intentionally does NOT call
   * `EnrollmentRepository.getEnrollments` here. That helper exists for
   * the "currently Enrolled" dashboard tab, and its pipeline hard-filters
   * `status: 'ACTIVE'` plus excludes records whose course version has
   * been archived or whose courseId no longer resolves. When a course is
   * completed, ViBe sets `percentCompleted = 100` but does NOT change
   * `status` — yet the course moves out of the Enrolled list on the
   * frontend. The exact signal for "this course moved to the Completed
   * section" varies (sometimes still ACTIVE, sometimes a different status,
   * sometimes the course version is archived). So instead of trying to
   * match the frontend's section logic, we aggregate straight off the
   * `enrollment` collection with the only the filters that are guaranteed
   * correct: the user owns the record, it hasn't been soft-deleted, and
   * it's a STUDENT-role enrollment (instructors/TAs have their own
   * enrollments that shouldn't affect a student's companion).
   *
   * Examples (sum / count = average across all sections):
   *   [100]                  -> 100   (1 completed course → Adult)
   *   [100, 0]               ->  50   (Completed 100 + new Enrolled 0 → de-Adult)
   *   [100, 0, 0]            ->  33   (Completed 100 + 2 fresh Enrolled)
   *   [100, 100, 50]         ->  83   (2 Completed + 1 Enrolled mid-way)
   *   []                     ->   0   (no enrollments → Baby + neutral)
   *
   * Soft-deleted enrollments (`isDeleted: true`) are excluded — those
   * are records the student left, not records representing active or
   * completed learning. Hard-deleted records (truly absent from the
   * collection) are naturally excluded.
   *
   * Falls back to 0 on any error or zero enrollments.
   */
  private async _getRealProgress(userId: string): Promise<number> {
    try {
      const enrollmentsCollection = (await this.db.getCollection(
        'enrollments',
      )) as Collection;

      const userIdStr = String(userId);
      const userIdObj = ObjectId.isValid(userIdStr)
        ? new ObjectId(userIdStr)
        : null;
      const userIdMatch = userIdObj
        ? {$in: [userIdStr, userIdObj]}
        : userIdStr;

      // Single aggregation across ALL enrollments for the user — no
      // status filter, no course-version lookup, no course-existence
      // join. We only need `percentCompleted`. We average in MongoDB
      // itself rather than paging in Node: this returns one number
      // regardless of how many courses the student has.
      const result = await enrollmentsCollection
        .aggregate([
          {
            $match: {
              userId: userIdMatch,
              role: 'STUDENT',
              isDeleted: {$ne: true},
            },
          },
          {
            $group: {
              _id: null,
              avgPct: {$avg: {$ifNull: ['$percentCompleted', 0]}},
              count: {$sum: 1},
            },
          },
        ])
        .toArray();

      if (!Array.isArray(result) || result.length === 0) return 0;
      const {avgPct} = result[0] as {avgPct?: number | null; count: number};
      if (typeof avgPct !== 'number' || Number.isNaN(avgPct)) return 0;
      // All inputs are >= 0, so Math.round() is plain half-up.
      return Math.round(avgPct);
    } catch {
      return 0;
    }
  }

  /**
   * Most recent quiz score for a student (single latest, not average).
   * Used for the graduation-cap gate: quizScore > 85 unlocks the cap.
   * Grabs the single most-recently-graded submission.
   * Falls back to 0 if no scored submission exists.
   */
  private async _getLatestQuizScore(userId: string): Promise<number> {
    try {
      const submissionsCollection = await this.db.getCollection('quiz_submission_results');
      const userIdStr = String(userId);
      const userIdObj = ObjectId.isValid(userIdStr) ? new ObjectId(userIdStr) : null;
      const userIdMatch = userIdObj
        ? {$in: [userIdStr, userIdObj]}
        : userIdStr;
      const doc = await (submissionsCollection as Collection).findOne(
        {
          userId: userIdMatch,
          'gradingResult.totalScore': {$exists: true, $ne: null},
        },
        {sort: {'gradingResult.gradedAt': -1}},
      );
      if (!doc) return 0;
      const score = doc.gradingResult?.totalScore;
      return typeof score === 'number' ? Math.round(score) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Days since the student's most recent learning activity.
   *
   * Activity = max(watchTime.endTime, quiz_attempt.gradedAt,
   * enrollment.createdAt) across all of the user's records. Falls back to
   * the enrollment date when no other signal exists, so a brand-new
   * student sees `idle=0` on first visit. Replaces the previous
   * `_daysSinceEnrollment` which only read `enrollment.enrollmentDate`
   * and made a returning student who enrolled a year ago look "idle=365"
   * even after they just finished a lesson.
   */
  private async _daysSinceLastActivity(userId: string): Promise<number> {
    try {
      const userIdStr = String(userId);
      const userIdObj = ObjectId.isValid(userIdStr)
        ? new ObjectId(userIdStr)
        : null;
      const userIdMatch = userIdObj
        ? {$in: [userIdStr, userIdObj]}
        : userIdStr;

      // Probe both watchTime and quiz_attempts (gradedAt). Max of the two
      // gives the most recent activity. Returns null when no record exists.
      const [watch, quiz, enrollments] = await Promise.all([
        (await this.db.getCollection('watchTime') as Collection)
          .findOne(
            {userId: userIdMatch},
            {sort: {endTime: -1}},
          ),
        (await this.db.getCollection('quiz_submission_results') as Collection)
          .findOne(
            {userId: userIdMatch, 'gradingResult.gradedAt': {$exists: true}},
            {sort: {'gradingResult.gradedAt': -1}},
          ),
        (async () => {
          // First enrollment = when the student first signed up.
          const page = (await this.enrollmentRepo.getEnrollments(
            userId, 0, 1, '', 'STUDENT',
          )) as unknown as Array<{enrollmentDate?: Date}>;
          return Array.isArray(page) ? page[0] : undefined;
        })(),
      ]);

      const candidates: Array<Date | string | undefined> = [
        (watch as {endTime?: Date | null})?.endTime,
        (quiz as {gradingResult?: {gradedAt?: Date | null}})?.gradingResult?.gradedAt,
        (enrollments as {enrollmentDate?: Date})?.enrollmentDate,
      ];
      const dates = candidates
        .filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()));
      if (dates.length === 0) return 0;

      const lastActivity = new Date(Math.max(...dates.map(d => d.getTime())));
      const msPerDay = 1000 * 60 * 60 * 24;
      const diffMs = Date.now() - lastActivity.getTime();
      return Math.max(0, Math.floor(diffMs / msPerDay));
    } catch {
      return 0;
    }
  }

  // ─── Growth & mood derivation ────────────────────────────────────────────

  /**
   * Stage index from progress — prototype thresholds: [0,17,33,50,67,83,100].
   * Stage 5 (Adult) only reached at p=100 — but progress can dip back
   * below 100 (new enrollment drags average down); stage reflects current
   * liveProgress, not a lifetime peak.
   */
  private _computeStage(progress: number): GrowthStage {
    if (progress >= 83) return 5;
    if (progress >= 67) return 4;
    if (progress >= 50) return 3;
    if (progress >= 33) return 2;
    if (progress >= 17) return 1;
    return 0;
  }

  /**
   * Derive mood from real progress + idle days.
   * Mirrors prototype AMOOD(p, i) exactly:
   *   p >= 100 → celebrating
   *   i >= 5   → sleeping
   *   i >= 3   → angry
   *   i >= 1   → sad
   *   p >= 40  → excited
   *   else     → happy
   *
   * NOTE: studying is a LIVE SIGNAL — the frontend pushes it when the
   * student is actively in a lesson. It is NEVER produced here.
   */
  private _deriveMood(progress: number, idleDays: number): CompanionMood {
    if (progress >= 100) return 'celebrating';
    if (idleDays >= 5)   return 'sleeping';
    if (idleDays >= 3)   return 'angry';
    if (idleDays >= 1)   return 'sad';
    // Brand-new student with zero activity: idleDays=0 (no records yet)
    // and progress=0 (never enrolled). Show neutral instead of happy —
    // the student genuinely has nothing on the go yet.
    if (idleDays === 0 && progress === 0) return 'neutral';
    if (progress >= 40)  return 'excited';
    return 'happy';
  }
}

export {CompanionService};