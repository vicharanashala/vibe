import {ObjectId} from 'mongodb';
import {inject, injectable} from 'inversify';
import {BadRequestError, ForbiddenError, NotFoundError} from 'routing-controllers';
import {CASE_STUDIES_TYPES} from '../types.js';
import {
  CaseStudyRepository,
  ICaseStudyStats,
} from '../repositories/providers/mongodb/CaseStudyRepository.js';
import {CaseResponse, ICaseResponse} from '../classes/transformers/CaseResponse.js';
import {CaseStudy, ICaseStudy} from '../classes/transformers/CaseStudy.js';
import {CaseComparisonOutcome} from '../classes/transformers/CaseComparison.js';
import {
  DEFAULT_WEAK_STREAK_THRESHOLD,
  ELEMENT_2A_MIN_WORDS,
  MAX_LIST_LIMIT,
  computeMinimumScreenTimeSeconds,
  countWords,
} from '../constants.js';
import {SETTING_TYPES} from '../../setting/types.js';
import {CourseSettingService} from '../../setting/services/CourseSettingService.js';
import {NOTIFICATIONS_TYPES} from '../../notifications/types.js';
import {NotificationService} from '../../notifications/services/NotificationService.js';
import {USERS_TYPES} from '../../users/types.js';
import {ProgressService} from '../../users/services/ProgressService.js';

export type CaseStateForUser =
  | 'locked'
  | 'writable'
  | 'submitted-awaiting-verdict'
  | 'won'
  | 'withdrawn';

export interface CaseListEntry {
  caseStudyId: string;
  sequenceIndex: number;
  title: string;
  bodyMarkdown: string;
  linkedItemId: string | null;
  state: CaseStateForUser;
  /** Present only when the user has a response for this case. */
  myResponse?: {
    beat1a: string;
    beat1b: string;
    beat1c: string;
    steelman: string;
    roomPerspective: string;
    changeCommitment: string;
    weakStreak: number;
    /** true when weakStreak >= the course's weakStreakThreshold — client shows "Needs revision" CTA. */
    eligibleForRevision: boolean;
  };
}

export interface InstructorResponseRow {
  responseId: string;
  userId: string;
  studentName: string;
  studentEmail: string;
  status: 'OPEN' | 'WON' | 'WITHDRAWN';
  beat1a: string;
  beat1b: string;
  beat1c: string;
  steelman: string;
  roomPerspective: string;
  changeCommitment: string;
  zoomSessionDate?: string;
  winCount: number;
  weakStreak: number;
  comparisonsSeenCount: number;
  flagCount: number;
  submittedAt: string;
}

export interface InstructorCaseGroup {
  caseStudyId: string;
  sequenceIndex: number;
  title: string;
  responses: InstructorResponseRow[];
}

/**
 * A response as shown to a reviewing peer.
 *
 * This shape is the anonymity boundary: it is built field by field rather
 * than spread from the document (see `toServedPair`), so an author-
 * identifying field added to `ICaseResponse` later can never leak into a
 * review payload by default.
 *
 * Only `steelman` (element 2a) is exposed — the other five fields are
 * private to the author.
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

@injectable()
export class CaseStudyService {
  constructor(
    @inject(CASE_STUDIES_TYPES.CaseStudyRepo)
    private readonly repository: CaseStudyRepository,
    @inject(SETTING_TYPES.CourseSettingService)
    private readonly courseSettingService: CourseSettingService,
    @inject(NOTIFICATIONS_TYPES.NotificationService)
    private readonly notificationService: NotificationService,
    @inject(USERS_TYPES.ProgressService)
    private readonly progressService: ProgressService,
  ) {}

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

  /**
   * The `caseStudiesEnabled` toggle used to only gate the frontend drawer tab
   * — every backend route stayed reachable by URL regardless of the flag.
   * Every participant-facing entry point below now re-checks it server-side.
   */
  private assertCaseStudiesEnabled(settings: CaseStudySettings): void {
    if (!settings.enabled) {
      throw new ForbiddenError('Case studies are not enabled for this course version.');
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
   * Every case in a version, annotated with this user's own state.
   *
   * Unlock is video-gated: a case is writable when the student has completed
   * the case's `linkedItemId` video. Cases with no `linkedItemId` are always
   * locked until an instructor links a video.
   */
  async listCasesForUser(input: {
    userId: string;
    courseId: string;
    courseVersionId: string;
  }): Promise<CaseListEntry[]> {
    const settings = await this.getCaseStudySettings(input.courseId, input.courseVersionId);
    this.assertCaseStudiesEnabled(settings);

    const [cases, responses] = await Promise.all([
      this.repository.listByCourseVersion(input.courseVersionId),
      this.repository.listUserResponsesForVersion(
        input.userId,
        input.courseVersionId,
      ),
    ]);
    const responseByCase = new Map(
      responses.map(r => [r.caseStudyId.toString(), r]),
    );

    return Promise.all(
      cases.map(async c => {
        const caseId = c._id!.toString();
        const response = responseByCase.get(caseId);
        let state: CaseStateForUser;

        if (response) {
          if (response.status === 'WON') state = 'won';
          else if (response.status === 'WITHDRAWN') state = 'withdrawn';
          else state = 'submitted-awaiting-verdict';
        } else if (c.linkedItemId) {
          const completed = await this.progressService.isItemCompleted(
            input.userId,
            input.courseId,
            input.courseVersionId,
            c.linkedItemId.toString(),
          );
          state = completed ? 'writable' : 'locked';
        } else {
          // DEMO: no linkedItemId → writable; revert this commit to restore video-gate
          state = 'writable';
        }

        const entry: CaseListEntry = {
          caseStudyId: caseId,
          sequenceIndex: c.sequenceIndex,
          title: c.title,
          bodyMarkdown: c.bodyMarkdown,
          linkedItemId: c.linkedItemId ? c.linkedItemId.toString() : null,
          state,
        };
        if (response) {
          entry.myResponse = {
            beat1a: response.beat1a,
            beat1b: response.beat1b,
            beat1c: response.beat1c,
            steelman: response.steelman,
            roomPerspective: response.roomPerspective,
            changeCommitment: response.changeCommitment,
            weakStreak: response.weakStreak,
            eligibleForRevision:
              settings.weakStreakThreshold > 0 &&
              response.weakStreak >= settings.weakStreakThreshold,
          };
        }
        return entry;
      }),
    );
  }

  async getMyResponse(input: {
    userId: string;
    caseStudyId: string;
  }): Promise<ICaseResponse | null> {
    const caseStudy = await this.getCaseStudyOrThrow(input.caseStudyId);
    const settings = await this.getCaseStudySettings(
      caseStudy.courseId.toString(),
      caseStudy.courseVersionId.toString(),
    );
    this.assertCaseStudiesEnabled(settings);
    return this.repository.findUserResponse(input.userId, input.caseStudyId);
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
    const fields = {
      beat1a: input.beat1a.trim(),
      beat1b: input.beat1b.trim(),
      beat1c: input.beat1c.trim(),
      steelman: input.steelman.trim(),
      roomPerspective: input.roomPerspective.trim(),
      changeCommitment: input.changeCommitment.trim(),
    };

    const steelmanWordCount = countWords(fields.steelman);
    if (steelmanWordCount === 0) {
      throw new BadRequestError('The steelman field cannot be empty.');
    }
    if (steelmanWordCount < ELEMENT_2A_MIN_WORDS) {
      throw new BadRequestError(
        `The steelman must be at least ${ELEMENT_2A_MIN_WORDS} words (this one is ${steelmanWordCount}).`,
      );
    }

    const caseStudy = await this.getCaseStudyOrThrow(input.caseStudyId);
    const settings = await this.getCaseStudySettings(
      caseStudy.courseId.toString(),
      caseStudy.courseVersionId.toString(),
    );
    this.assertCaseStudiesEnabled(settings);

    // Video-based unlock: the case must be linked to a video, and that video
    // must be completed by this student.
    if (!caseStudy.linkedItemId) {
      throw new BadRequestError(
        'This case study is not yet linked to a video. Awaiting video link from instructor.',
      );
    }
    const videoCompleted = await this.progressService.isItemCompleted(
      input.userId,
      caseStudy.courseId.toString(),
      caseStudy.courseVersionId.toString(),
      caseStudy.linkedItemId.toString(),
    );
    if (!videoCompleted) {
      throw new BadRequestError(
        'Watch the linked video first to unlock this case study.',
      );
    }

    // Fast path: a readable rejection for the common case. The unique
    // (userId, caseStudyId) index is the real race guard.
    const existing = await this.repository.findUserResponse(
      input.userId,
      input.caseStudyId,
    );
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
    const settings = await this.getCaseStudySettings(
      caseStudy.courseId.toString(),
      caseStudy.courseVersionId.toString(),
    );
    this.assertCaseStudiesEnabled(settings);

    const pending = await this.repository.findPendingComparison(
      input.reviewerId,
      input.caseStudyId,
    );
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
    this.assertCaseStudiesEnabled(settings);

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

    const decided = await this.repository.recordPick({
      comparisonId: input.comparisonId,
      outcome: input.outcome,
    });
    if (!decided) {
      throw new BadRequestError('This comparison has already been decided.');
    }

    const {weakStreaks, withdrawals} = await this.repository.applyPickEffects({
      responseAId: comparison.responseAId,
      responseBId: comparison.responseBId,
      outcome: input.outcome,
    });

    if (input.outcome !== 'FLAGGED') {
      // A/B/BOTH_WEAK are substantive judgments and count toward the
      // reviewer's own progress; an unjudgeable flag does not
      // (PLANNING.md §4.5/§4.8).
      await this.repository.incrementReviewerQuota(
        input.reviewerId,
        comparison.caseStudyId.toString(),
      );
    }

    // Fire once, exactly on the round the streak crosses the threshold —
    // not on every subsequent loss — so an author isn't spammed once they're
    // already below the bar.
    if (settings.weakStreakThreshold > 0) {
      for (const streak of weakStreaks) {
        if (streak.weakStreak === settings.weakStreakThreshold) {
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
    const fields = {
      beat1a: input.beat1a.trim(),
      beat1b: input.beat1b.trim(),
      beat1c: input.beat1c.trim(),
      steelman: input.steelman.trim(),
      roomPerspective: input.roomPerspective.trim(),
      changeCommitment: input.changeCommitment.trim(),
    };

    const steelmanWordCount = countWords(fields.steelman);
    if (steelmanWordCount === 0) {
      throw new BadRequestError('The steelman field cannot be empty.');
    }
    if (steelmanWordCount < ELEMENT_2A_MIN_WORDS) {
      throw new BadRequestError(
        `The steelman must be at least ${ELEMENT_2A_MIN_WORDS} words (this one is ${steelmanWordCount}).`,
      );
    }

    const caseStudy = await this.getCaseStudyOrThrow(input.caseStudyId);
    const settings = await this.getCaseStudySettings(
      caseStudy.courseId.toString(),
      caseStudy.courseVersionId.toString(),
    );
    this.assertCaseStudiesEnabled(settings);

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
        settings.weakStreakThreshold === 0 ||
        existing.weakStreak < settings.weakStreakThreshold
      ) {
        throw new BadRequestError(
          `Your response is not yet eligible for revision. It must receive ${settings.weakStreakThreshold} consecutive weak verdicts first (current streak: ${existing.weakStreak}).`,
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

  // ---------------------------------------------------------------------
  // Instructor / admin
  // ---------------------------------------------------------------------

  async getResponsesForInstructor(courseVersionId: string): Promise<InstructorCaseGroup[]> {
    const [cases, responses] = await Promise.all([
      this.repository.listByCourseVersion(courseVersionId),
      this.repository.listAllResponsesByVersion(courseVersionId),
    ]);

    const byCase = new Map<string, InstructorResponseRow[]>();
    for (const c of cases) byCase.set(c._id!.toString(), []);

    for (const r of responses) {
      const caseId = r.caseStudyId.toString();
      if (!byCase.has(caseId)) continue;
      byCase.get(caseId)!.push({
        responseId: r._id!.toString(),
        userId: r.userId.toString(),
        studentName: r.student
          ? [r.student.firstName, r.student.lastName].filter(Boolean).join(' ')
          : r.userId.toString(),
        studentEmail: r.student?.email ?? '—',
        status: r.status,
        // Fall back to legacy `text` field for responses submitted before the 6-field schema.
        beat1a: r.beat1a ?? (r as any).text ?? '',
        beat1b: r.beat1b ?? '',
        beat1c: r.beat1c ?? '',
        steelman: r.steelman ?? '',
        roomPerspective: r.roomPerspective ?? '',
        changeCommitment: r.changeCommitment ?? '',
        zoomSessionDate: r.zoomSessionDate,
        winCount: r.winCount,
        weakStreak: r.weakStreak,
        comparisonsSeenCount: r.comparisonsSeenCount,
        flagCount: r.flagCount,
        submittedAt: r.createdAt.toISOString(),
      });
    }

    return cases.map(c => ({
      caseStudyId: c._id!.toString(),
      sequenceIndex: c.sequenceIndex,
      title: c.title,
      responses: byCase.get(c._id!.toString()) ?? [],
    }));
  }

  async createCaseStudy(input: {
    courseId: string;
    courseVersionId: string;
    sequenceIndex: number;
    title: string;
    bodyMarkdown: string;
    linkedItemId?: string;
  }): Promise<{caseStudyId: string}> {
    const id = await this.repository.create(new CaseStudy(input));
    if (id === null) {
      throw new BadRequestError(
        `A case study already exists at sequence position ${input.sequenceIndex} for this version.`,
      );
    }
    return {caseStudyId: id};
  }

  async updateCaseStudy(
    caseStudyId: string,
    patch: {
      title?: string;
      bodyMarkdown?: string;
      sequenceIndex?: number;
      linkedItemId?: string;
    },
  ): Promise<void> {
    const ok = await this.repository.update(caseStudyId, patch);
    if (!ok) throw new NotFoundError('Case study not found.');
  }

  async deleteCaseStudy(caseStudyId: string): Promise<void> {
    const ok = await this.repository.softDelete(caseStudyId);
    if (!ok) throw new NotFoundError('Case study not found.');
  }

  async getInstructorStats(courseVersionId: string): Promise<ICaseStudyStats> {
    return this.repository.getStats(courseVersionId);
  }

  /** Used by `scripts/seedCaseStudies.ts` — the version-controlled authoring path. */
  async upsertFromSeed(input: {
    courseId: string;
    courseVersionId: string;
    entries: Array<{
      sequenceIndex: number;
      title: string;
      bodyMarkdown: string;
      linkedItemId?: string;
    }>;
  }): Promise<{inserted: number; updated: number}> {
    return this.repository.upsertFromSeed(
      input.courseVersionId,
      input.courseId,
      input.entries,
    );
  }

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
