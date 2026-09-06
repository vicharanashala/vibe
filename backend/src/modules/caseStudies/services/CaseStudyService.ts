import {ObjectId} from 'mongodb';
import {inject, injectable} from 'inversify';
import {BadRequestError, ForbiddenError, NotFoundError} from 'routing-controllers';
import {CASE_STUDIES_TYPES} from '../types.js';
import {CaseStudyRepository} from '../repositories/providers/mongodb/CaseStudyRepository.js';
import {CaseResponse, ICaseResponse} from '../classes/transformers/CaseResponse.js';
import {ICaseStudy} from '../classes/transformers/CaseStudy.js';
import {CaseComparisonOutcome} from '../classes/transformers/CaseComparison.js';
import {
  DEFAULT_WEAK_STREAK_THRESHOLD,
  ELEMENT_2A_MIN_WORDS,
  FIELD_MIN_WORDS,
  MAX_LIST_LIMIT,
  REVIEWER_MIN_PICKS_PER_CASE,
  WINS_REQUIRED,
  computeMinimumScreenTimeSeconds,
  countWords,
  isGibberish,
} from '../constants.js';
import {SETTING_TYPES} from '../../setting/types.js';
import {CourseSettingService} from '../../setting/services/CourseSettingService.js';
import {NOTIFICATIONS_TYPES} from '../../notifications/types.js';
import {NotificationService} from '../../notifications/services/NotificationService.js';
import {COURSES_TYPES} from '../../courses/types.js';
import {IItemRepository} from '../../../shared/database/interfaces/IItemRepository.js';
import {BaseService} from '#root/shared/classes/BaseService.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {GLOBAL_TYPES} from '#root/types.js';

/**
 * A response as shown to a reviewing peer.
 *
 * This shape is the anonymity boundary: it is built field by field rather
 * than spread from the document (see `toServedPair`), so an author-
 * identifying field added to `ICaseResponse` later can never leak into a
 * review payload by default.
 *
 * All six response fields are exposed to peer reviewers — anonymised by
 * omitting `userId`, but not field-filtered.
 */
export interface ServedPairResponseView {
  responseId: string;
  beat1a: string;
  beat1b: string;
  beat1c: string;
  steelman: string;
  roomPerspective: string;
  changeCommitment: string;
  wordCount: number;
  /**
   * Submit this exact value as `outcome` when the participant picks this
   * side as better. Sides are randomised left/right per serve (`sideAIsLeft`
   * internally) to avoid position bias, so the client must read this off the
   * response it renders rather than assuming "left" always means A.
   */
  outcome: 'A' | 'B';
}

export interface ServedPair {
  comparisonId: string;
  caseStudyId: string;
  left: ServedPairResponseView;
  right: ServedPairResponseView;
  servedAt: string;
  minimumScreenTimeSeconds: number;
}

interface CaseStudySettings {
  enabled: boolean;
  weakStreakThreshold: number;
}

type ResponseFields = {
  beat1a: string;
  beat1b: string;
  beat1c: string;
  steelman: string;
  roomPerspective: string;
  changeCommitment: string;
};

@injectable()
export class CaseStudyService extends BaseService {
  constructor(
    @inject(GLOBAL_TYPES.Database) db: MongoDatabase,
    @inject(CASE_STUDIES_TYPES.CaseStudyRepo)
    private readonly repository: CaseStudyRepository,
    @inject(SETTING_TYPES.CourseSettingService)
    private readonly courseSettingService: CourseSettingService,
    @inject(NOTIFICATIONS_TYPES.NotificationService)
    private readonly notificationService: NotificationService,
    @inject(COURSES_TYPES.ItemRepo)
    private readonly itemRepo: IItemRepository,
  ) {
    super(db);
  }

  /**
   * Sync the case record backing a CASE_STUDY course item, then return it.
   * Idempotent — the learner panel calls this on open, passing the course
   * context it already has, so the peer-review runtime can key on the item's
   * own id without a separate authoring step or an item→version lookup.
   */
  async ensureCaseForItem(input: {
    courseId: string;
    courseVersionId: string;
    itemId: string;
  }): Promise<ICaseStudy> {
    const item = await this.itemRepo.readItemById(input.itemId);
    if (!item || (item as any).type !== 'CASE_STUDY') {
      throw new NotFoundError('Case study item not found.');
    }
    const details = (item as any).details ?? {};
    await this.repository.upsertForItem({
      itemId: input.itemId,
      courseId: input.courseId,
      courseVersionId: input.courseVersionId,
      title: (item as any).name ?? 'Case study',
      bodyMarkdown: details.bodyMarkdown ?? '',
      reviewsRequired: details.reviewsRequired,
      picksRequired: details.picksRequired,
      weakStreakThreshold: details.weakStreakThreshold,
    });
    return this.getCaseStudyOrThrow(input.itemId);
  }

  /** Resolves the course-version-level toggles that govern this feature. */
  private async getCaseStudySettings(
    courseId: string,
    courseVersionId: string,
  ): Promise<CaseStudySettings> {
    const courseSettings = await this.courseSettingService.readCourseSettings(
      courseId,
      courseVersionId,
    );
    return {
      enabled: courseSettings?.settings?.caseStudiesEnabled ?? false,
      weakStreakThreshold:
        courseSettings?.settings?.caseStudyWeakStreakThreshold ??
        DEFAULT_WEAK_STREAK_THRESHOLD,
    };
  }

  private trimResponseFields(input: ResponseFields): ResponseFields {
    return {
      beat1a: input.beat1a.trim(),
      beat1b: input.beat1b.trim(),
      beat1c: input.beat1c.trim(),
      steelman: input.steelman.trim(),
      roomPerspective: input.roomPerspective.trim(),
      changeCommitment: input.changeCommitment.trim(),
    };
  }

  private validateResponseFields(fields: ResponseFields): void {
    const single: Array<{name: string; value: string}> = [
      {name: 'beat1a', value: fields.beat1a},
      {name: 'beat1b', value: fields.beat1b},
      {name: 'beat1c', value: fields.beat1c},
      {name: 'roomPerspective', value: fields.roomPerspective},
      {name: 'changeCommitment', value: fields.changeCommitment},
    ];
    for (const {name, value} of single) {
      const wc = countWords(value);
      if (wc < FIELD_MIN_WORDS) {
        throw new BadRequestError(
          `The "${name}" field must be at least ${FIELD_MIN_WORDS} words (got ${wc}).`,
        );
      }
      if (isGibberish(value)) {
        throw new BadRequestError(
          `The "${name}" field appears to contain repeated or meaningless text. Please write a genuine response.`,
        );
      }
    }
    const steelmanWc = countWords(fields.steelman);
    if (steelmanWc < ELEMENT_2A_MIN_WORDS) {
      throw new BadRequestError(
        `The steelman must be at least ${ELEMENT_2A_MIN_WORDS} words (this one is ${steelmanWc}).`,
      );
    }
    if (isGibberish(fields.steelman)) {
      throw new BadRequestError(
        'The steelman field appears to contain repeated or meaningless text. Please write a genuine argument.',
      );
    }
  }

  private async notifyWeakResponseStreak(
    userId: ObjectId,
    caseStudy: ICaseStudy,
    weakStreak: number,
  ): Promise<void> {
    try {
      await this.notificationService.createNotification({
        userId,
        type: 'case_response_weak_streak',
        title: 'Your case study response may need work',
        message:
          `Reviewers have picked another response over yours for "${caseStudy.title}" ` +
          `${weakStreak} times in a row. Consider revising it for clarity and depth.`,
        courseId: caseStudy.courseId,
        courseVersionId: caseStudy.courseVersionId,
        read: false,
        createdAt: new Date(),
        extra: {caseStudyId: caseStudy._id?.toString(), weakStreak},
      });
    } catch (err) {
      // Best-effort: don't fail the pick submission if the notification fails.
      console.error('Failed to emit case-study weak-streak notification', err);
    }
  }

  async getCaseStudyOrThrow(caseStudyId: string): Promise<ICaseStudy> {
    const caseStudy = await this.repository.findById(caseStudyId);
    if (!caseStudy) {
      throw new NotFoundError('Case study not found.');
    }
    return caseStudy;
  }

  /** Resolves the course/version a comparison belongs to, for routes keyed only by comparisonId. */
  async getComparisonContext(
    comparisonId: string,
  ): Promise<{courseId: string; courseVersionId: string; caseStudyId: string}> {
    const comparison = await this.repository.findComparisonById(comparisonId);
    if (!comparison) {
      throw new NotFoundError('Comparison not found.');
    }
    const caseStudy = await this.getCaseStudyOrThrow(
      comparison.caseStudyId.toString(),
    );
    return {
      courseId: caseStudy.courseId.toString(),
      courseVersionId: caseStudy.courseVersionId.toString(),
      caseStudyId: comparison.caseStudyId.toString(),
    };
  }

  /**
   * This learner's own response to a case, plus the two per-item facts the
   * panel needs: whether it is eligible for revision (weak-streak nudge), and
   * their review progress against the case's `picksRequired` soft floor.
   */
  async getMyResponse(input: {
    userId: string;
    caseStudyId: string;
  }): Promise<{
    response: ICaseResponse | null;
    eligibleForRevision: boolean;
    picksRequired: number;
    picksCompleted: number;
  }> {
    const caseStudy = await this.getCaseStudyOrThrow(input.caseStudyId);
    const picksRequired =
      caseStudy.picksRequired ?? REVIEWER_MIN_PICKS_PER_CASE;
    const response = await this.repository.findUserResponse(
      input.userId,
      input.caseStudyId,
    );
    if (!response) {
      return {
        response: null,
        eligibleForRevision: false,
        picksRequired,
        picksCompleted: 0,
      };
    }
    const [settings, picksCompleted] = await Promise.all([
      this.getCaseStudySettings(
        caseStudy.courseId.toString(),
        caseStudy.courseVersionId.toString(),
      ),
      this.repository.getReviewerQuota(input.userId, input.caseStudyId),
    ]);
    const weakStreakThreshold =
      caseStudy.weakStreakThreshold ?? settings.weakStreakThreshold;
    // A response can be revised once it has lost the configured number of times
    // in a row (the weak-streak nudge). Winning responses are locked.
    const eligibleForRevision =
      response.status !== 'WON' &&
      weakStreakThreshold > 0 &&
      response.weakStreak >= weakStreakThreshold;
    return {response, eligibleForRevision, picksRequired, picksCompleted};
  }

  /**
   * Record a participant's response to a case. The case must have a linked
   * video, and the student must have completed that video.
   */
  async submitResponse(input: {
    userId: string;
    caseStudyId: string;
    beat1a: string;
    beat1b: string;
    beat1c: string;
    steelman: string;
    roomPerspective: string;
    changeCommitment: string;
    zoomSessionDate?: string;
  }): Promise<{responseId: string}> {
    const fields = this.trimResponseFields(input);
    this.validateResponseFields(fields);

    const caseStudy = await this.getCaseStudyOrThrow(input.caseStudyId);

    // Fetch settings and check for an existing submission in parallel.
    const [settings, existing] = await Promise.all([
      this.getCaseStudySettings(
        caseStudy.courseId.toString(),
        caseStudy.courseVersionId.toString(),
      ),
      this.repository.findUserResponse(input.userId, input.caseStudyId),
    ]);

    if (!settings.enabled) {
      throw new ForbiddenError('Case studies are not enabled for this course version.');
    }

    // Fast path: a readable rejection for the common case. The unique
    // (userId, caseStudyId) index is the real race guard.
    if (existing) {
      throw new BadRequestError(
        'You have already submitted a response for this case study.',
      );
    }

    const responseId = await this.repository.createResponse(
      new CaseResponse({
        userId: input.userId,
        courseVersionId: caseStudy.courseVersionId.toString(),
        caseStudyId: input.caseStudyId,
        ...fields,
        zoomSessionDate: input.zoomSessionDate,
      }),
    );
    if (responseId === null) {
      // Two concurrent submissions from this user raced the unique index.
      throw new BadRequestError(
        'You have already submitted a response for this case study.',
      );
    }
    return {responseId};
  }

  /**
   * Serve the next pair for this reviewer, or null when the pool is
   * exhausted — an ordinary state, not an error (matches
   * `ReflectionService.getNextForReview`'s null-not-404 contract).
   */
  async getNextPair(input: {
    reviewerId: string;
    caseStudyId: string;
  }): Promise<ServedPair | null> {
    const caseStudy = await this.getCaseStudyOrThrow(input.caseStudyId);

    // Fetch settings and check for a pending comparison in parallel.
    const [settings, pending] = await Promise.all([
      this.getCaseStudySettings(
        caseStudy.courseId.toString(),
        caseStudy.courseVersionId.toString(),
      ),
      this.repository.findPendingComparison(input.reviewerId, input.caseStudyId),
    ]);

    if (!settings.enabled) {
      throw new ForbiddenError('Case studies are not enabled for this course version.');
    }

    if (pending) {
      return this.toServedPair(pending);
    }

    const candidate = await this.repository.pickPairCandidate(
      input.caseStudyId,
      input.reviewerId,
    );
    if (!candidate) return null;
    const [responseA, responseB] = candidate;

    const minimumScreenTimeSeconds = computeMinimumScreenTimeSeconds(
      countWords(responseA.steelman),
      countWords(responseB.steelman),
    );

    const comparison = await this.repository.createComparison({
      caseStudyId: input.caseStudyId,
      courseVersionId: caseStudy.courseVersionId.toString(),
      reviewerId: input.reviewerId,
      responseAId: responseA._id!.toString(),
      responseBId: responseB._id!.toString(),
      sideAIsLeft: Math.random() < 0.5,
      servedAt: new Date(),
      minimumScreenTimeSeconds,
    });
    if (!comparison) {
      // A concurrent request from the same reviewer just served this exact
      // pair — treat it as "already pending" rather than an error.
      const raced = await this.repository.findPendingComparison(
        input.reviewerId,
        input.caseStudyId,
      );
      return raced ? this.toServedPair(raced) : null;
    }
    return this.toServedPair(comparison);
  }

  private async toServedPair(comparison: {
    _id?: any;
    caseStudyId: any;
    responseAId: any;
    responseBId: any;
    sideAIsLeft: boolean;
    servedAt: Date;
    minimumScreenTimeSeconds: number;
  }): Promise<ServedPair> {
    const [responseA, responseB] = await Promise.all([
      this.repository.findResponseById(comparison.responseAId.toString()),
      this.repository.findResponseById(comparison.responseBId.toString()),
    ]);
    if (!responseA || !responseB) {
      throw new NotFoundError('One of the compared responses no longer exists.');
    }

    const viewA: ServedPairResponseView = {
      responseId: responseA._id!.toString(),
      beat1a: responseA.beat1a,
      beat1b: responseA.beat1b,
      beat1c: responseA.beat1c,
      steelman: responseA.steelman,
      roomPerspective: responseA.roomPerspective,
      changeCommitment: responseA.changeCommitment,
      wordCount: countWords(responseA.steelman),
      outcome: 'A',
    };
    const viewB: ServedPairResponseView = {
      responseId: responseB._id!.toString(),
      beat1a: responseB.beat1a,
      beat1b: responseB.beat1b,
      beat1c: responseB.beat1c,
      steelman: responseB.steelman,
      roomPerspective: responseB.roomPerspective,
      changeCommitment: responseB.changeCommitment,
      wordCount: countWords(responseB.steelman),
      outcome: 'B',
    };

    return {
      comparisonId: comparison._id!.toString(),
      caseStudyId: comparison.caseStudyId.toString(),
      left: comparison.sideAIsLeft ? viewA : viewB,
      right: comparison.sideAIsLeft ? viewB : viewA,
      servedAt: comparison.servedAt.toISOString(),
      minimumScreenTimeSeconds: comparison.minimumScreenTimeSeconds,
    };
  }

  /**
   * Score a served pair. The timer check is server-side and trusts nothing
   * the client sends; the self-review guard is defense in depth (pairing
   * already excludes the reviewer's own responses, but this must never be
   * reachable even if that changes later) — mirrors
   * `ReflectionService.submitReview`'s equivalent guard.
   *
   * The three writes (recordPick, applyPickEffects, incrementReviewerQuota)
   * run inside a single MongoDB transaction so a process crash between them
   * cannot leave a comparison permanently decided but counters unstamped.
   */
  async submitPick(input: {
    reviewerId: string;
    comparisonId: string;
    outcome: CaseComparisonOutcome;
  }): Promise<{
    outcome: CaseComparisonOutcome;
    /** Readers of this exact pair (any reviewer) who chose the same outcome, this pick included. */
    agreementCount: number;
    /** Readers of this exact pair who gave a substantive verdict (A/B/BOTH_WEAK) — FLAGGED excluded. */
    totalJudged: number;
  }> {
    const comparison = await this.repository.findComparisonById(
      input.comparisonId,
    );
    if (!comparison) {
      throw new NotFoundError('Comparison not found.');
    }
    if (comparison.reviewerId.toString() !== input.reviewerId) {
      throw new ForbiddenError('This comparison was not served to you.');
    }

    const caseStudy = await this.getCaseStudyOrThrow(comparison.caseStudyId.toString());
    const settings = await this.getCaseStudySettings(
      caseStudy.courseId.toString(),
      caseStudy.courseVersionId.toString(),
    );
    const winsRequired = caseStudy.reviewsRequired ?? WINS_REQUIRED;
    const weakStreakThreshold =
      caseStudy.weakStreakThreshold ?? settings.weakStreakThreshold;

    const [responseA, responseB] = await Promise.all([
      this.repository.findResponseById(comparison.responseAId.toString()),
      this.repository.findResponseById(comparison.responseBId.toString()),
    ]);
    if (
      responseA?.userId.toString() === input.reviewerId ||
      responseB?.userId.toString() === input.reviewerId
    ) {
      throw new ForbiddenError('You cannot review your own response.');
    }

    const elapsedSeconds = (Date.now() - comparison.servedAt.getTime()) / 1000;
    if (elapsedSeconds < comparison.minimumScreenTimeSeconds) {
      throw new BadRequestError(
        'The minimum reading time for this pair has not elapsed yet.',
      );
    }

    // Wrap the three writes atomically so a mid-flight crash cannot leave the
    // comparison decided but response counters / reviewer quota unstamped.
    const {weakStreaks} = await this._withTransaction(async session => {
      const decided = await this.repository.recordPick(
        {comparisonId: input.comparisonId, outcome: input.outcome},
        session,
      );
      if (!decided) {
        throw new BadRequestError('This comparison has already been decided.');
      }

      const effects = await this.repository.applyPickEffects(
        {
          responseAId: comparison.responseAId,
          responseBId: comparison.responseBId,
          outcome: input.outcome,
          winsRequired,
        },
        session,
      );

      if (input.outcome !== 'FLAGGED') {
        // A/B/BOTH_WEAK are substantive judgments and count toward the
        // reviewer's own progress; an unjudgeable flag does not
        // (PLANNING.md §4.5/§4.8).
        await this.repository.incrementReviewerQuota(
          input.reviewerId,
          comparison.caseStudyId.toString(),
          session,
        );
      }

      return effects;
    });

    // Fire once, exactly on the round the streak crosses the threshold —
    // not on every subsequent loss — so an author isn't spammed once they're
    // already below the bar.
    if (weakStreakThreshold > 0) {
      for (const streak of weakStreaks) {
        if (streak.weakStreak === weakStreakThreshold) {
          await this.notifyWeakResponseStreak(streak.userId, caseStudy, streak.weakStreak);
        }
      }
    }

    const counts = await this.repository.getPairOutcomeCounts(
      comparison.responseAId,
      comparison.responseBId,
    );
    return {
      outcome: input.outcome,
      agreementCount: counts[input.outcome],
      totalJudged: counts.A + counts.B + counts.BOTH_WEAK,
    };
  }

  /**
   * Replace a response's six fields and start a fresh review cycle.
   * Only callable when the response has reached the weak-streak threshold,
   * meaning the notification has already fired and the author has been
   * explicitly prompted to revise.
   */
  async reviseResponse(input: {
    userId: string;
    caseStudyId: string;
    beat1a: string;
    beat1b: string;
    beat1c: string;
    steelman: string;
    roomPerspective: string;
    changeCommitment: string;
  }): Promise<{responseId: string}> {
    const fields = this.trimResponseFields(input);
    this.validateResponseFields(fields);

    const caseStudy = await this.getCaseStudyOrThrow(input.caseStudyId);
    const settings = await this.getCaseStudySettings(
      caseStudy.courseId.toString(),
      caseStudy.courseVersionId.toString(),
    );

    if (!settings.enabled) {
      throw new ForbiddenError('Case studies are not enabled for this course version.');
    }

    const weakStreakThreshold =
      caseStudy.weakStreakThreshold ?? settings.weakStreakThreshold;

    const existing = await this.repository.findUserResponse(
      input.userId,
      input.caseStudyId,
    );
    if (!existing) {
      throw new NotFoundError('You have not submitted a response for this case study yet.');
    }
    if (existing.status === 'WON') {
      throw new BadRequestError('A winning response cannot be revised.');
    }
    // Withdrawn responses are always eligible for revision regardless of weakStreak.
    if (existing.status !== 'WITHDRAWN') {
      if (
        weakStreakThreshold === 0 ||
        existing.weakStreak < weakStreakThreshold
      ) {
        throw new BadRequestError(
          `Your response is not yet eligible for revision. It must receive ${weakStreakThreshold} consecutive weak verdicts first (current streak: ${existing.weakStreak}).`,
        );
      }
    }

    const revised = await this.repository.reviseResponse(
      input.userId,
      input.caseStudyId,
      fields,
    );
    if (!revised) {
      throw new BadRequestError('Revision failed. Your response may have already been approved by peers.');
    }
    return {responseId: existing._id!.toString()};
  }

  /** All responses for a case study, newest first — for the instructor response viewer. */
  async listResponsesForInstructor(caseStudyId: string) {
    await this.getCaseStudyOrThrow(caseStudyId);
    const docs = await this.repository.listResponsesForInstructor(caseStudyId);
    // ObjectId fields don't survive class-transformer serialization as strings
    // unless explicitly converted; do it here at the service boundary.
    return docs.map(doc => ({
      ...doc,
      _id: doc._id?.toString(),
      userId: doc.userId.toString(),
      caseStudyId: doc.caseStudyId.toString(),
      courseVersionId: doc.courseVersionId.toString(),
    }));
  }

  // ---------------------------------------------------------------------
  // Integration (Samagama roster poll)
  // ---------------------------------------------------------------------

  /**
   * Per-learner facts for Samagama's roster poll. Never computes or returns
   * a "N of ~20 complete" boolean — that completion rule is Samagama's to
   * apply, not ViBe's (PLANNING.md §4.2).
   */
  async getIntegrationProgress(input: {
    courseVersionId: string;
    page: number;
    limit: number;
  }): Promise<{
    page: number;
    limit: number;
    totalLearners: number;
    totalPages: number;
    learners: Array<{
      userId: string;
      casesSubmitted: number;
      casesWon: number;
      casesInReview: number;
      lastActivityAt: Date | null;
    }>;
  }> {
    const page = Math.max(1, Math.floor(input.page) || 1);
    const limit = Math.min(Math.max(1, Math.floor(input.limit) || 50), MAX_LIST_LIMIT);
    const {totalLearners, learners} = await this.repository.getIntegrationProgress({
      courseVersionId: input.courseVersionId,
      page,
      limit,
    });
    return {
      page,
      limit,
      totalLearners,
      totalPages: Math.max(1, Math.ceil(totalLearners / limit)),
      learners,
    };
  }
}
