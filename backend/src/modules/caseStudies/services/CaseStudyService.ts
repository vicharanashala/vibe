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
  CASE_STUDY_RESPONSE_MAX_WORDS,
  DEFAULT_STRICT_UNLOCK_ENABLED,
  DEFAULT_WEAK_STREAK_THRESHOLD,
  MAX_LIST_LIMIT,
  computeMinimumScreenTimeSeconds,
  countWords,
} from '../constants.js';
import {SETTING_TYPES} from '../../setting/types.js';
import {CourseSettingService} from '../../setting/services/CourseSettingService.js';
import {NOTIFICATIONS_TYPES} from '../../notifications/types.js';
import {NotificationService} from '../../notifications/services/NotificationService.js';

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
    text: string;
    weakStreak: number;
    /** true when weakStreak >= the course's weakStreakThreshold — client shows "Needs revision" CTA. */
    eligibleForRevision: boolean;
  };
}

/**
 * A response as shown to a reviewing peer.
 *
 * This shape is the anonymity boundary: it is built field by field rather
 * than spread from the document (see `toServedPair`), so an author-
 * identifying field added to `ICaseResponse` later can never leak into a
 * review payload by default.
 */
export interface ServedPairResponseView {
  responseId: string;
  text: string;
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
  strictUnlockEnabled: boolean;
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
  ) {}

  /** Resolves the course-version-level toggles that govern this feature (PLANNING.md §4.2/§4.9). */
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
      strictUnlockEnabled:
        courseSettings?.settings?.caseStudyStrictUnlockEnabled ??
        DEFAULT_STRICT_UNLOCK_ENABLED,
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
   * Every case in a version, annotated with this user's own state. Sequence
   * unlock depends on the course's `caseStudyStrictUnlockEnabled` setting:
   * strict mode requires the previous case's response to have reached WON
   * status through peer review; non-strict (default) unlocks the next case
   * as soon as the previous one has any submitted response.
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

    return cases.map(c => {
      const caseId = c._id!.toString();
      const response = responseByCase.get(caseId);
      let state: CaseStateForUser;
      if (response) {
        if (response.status === 'WON') state = 'won';
        else if (response.status === 'WITHDRAWN') state = 'withdrawn';
        else state = 'submitted-awaiting-verdict';
      } else {
        // A case is writable when the user has no response for it AND either:
        // (a) it is the first case in the sequence, or
        // (b) the previous case is unlocked per the course's unlock mode.
        const previousCase = cases.find(pc => pc.sequenceIndex === c.sequenceIndex - 1);
        if (!previousCase) {
          // First case in the sequence — writable.
          state = 'writable';
        } else {
          const prevResponse = responseByCase.get(previousCase._id!.toString());
          state = settings.strictUnlockEnabled
            ? prevResponse?.status === 'WON'
              ? 'writable'
              : 'locked'
            : prevResponse
              ? 'writable'
              : 'locked';
        }
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
          text: response.text,
          weakStreak: response.weakStreak,
          eligibleForRevision:
            settings.weakStreakThreshold > 0 &&
            response.weakStreak >= settings.weakStreakThreshold,
        };
      }
      return entry;
    });
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
   * Record a participant's response to a case. One per participant per case;
   * the next case in sequence only unlocks after this response reaches WON
   * status through peer review.
   */
  async submitResponse(input: {
    userId: string;
    caseStudyId: string;
    text: string;
  }): Promise<{responseId: string}> {
    const text = input.text.trim();
    const wordCount = countWords(text);
    if (wordCount === 0) {
      throw new BadRequestError('A response cannot be empty.');
    }
    if (wordCount > CASE_STUDY_RESPONSE_MAX_WORDS) {
      throw new BadRequestError(
        `A response must be at most ${CASE_STUDY_RESPONSE_MAX_WORDS} words (this one is ${wordCount}).`,
      );
    }

    const caseStudy = await this.getCaseStudyOrThrow(input.caseStudyId);
    const settings = await this.getCaseStudySettings(
      caseStudy.courseId.toString(),
      caseStudy.courseVersionId.toString(),
    );
    this.assertCaseStudiesEnabled(settings);

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

    // Sequential unlock: Case N requires Case N-1 to be unlocked first. Case 1
    // (no predecessor) is always allowed. The rule for what "unlocked" means is
    // the course's `caseStudyStrictUnlockEnabled` toggle:
    //  - strict: Case N-1's own response must have reached WON status.
    //  - non-strict (default): Case N-1 must simply have been submitted —
    //    equivalent to requiring at least (sequenceIndex - 1) prior responses.
    if (caseStudy.sequenceIndex > 1) {
      if (settings.strictUnlockEnabled) {
        const prevCase = await this.repository.findByVersionAndSequenceIndex(
          caseStudy.courseVersionId.toString(),
          caseStudy.sequenceIndex - 1,
        );
        if (prevCase) {
          const prevResponse = await this.repository.findUserResponse(
            input.userId,
            prevCase._id!.toString(),
          );
          if (!prevResponse || prevResponse.status !== 'WON') {
            throw new BadRequestError(
              `Case ${caseStudy.sequenceIndex} is not yet unlocked. Your response to the previous case must be approved by peers first.`,
            );
          }
        }
      } else {
        // excludeCaseStudyId guards against a concurrent submission for this
        // same case bumping the count the other request reads, which would
        // otherwise make a still-in-flight request see itself as "one case
        // further along" and fail with a misleading "not yet unlocked".
        const priorResponseCount = await this.repository.countUserResponses(
          input.userId,
          caseStudy.courseVersionId.toString(),
          input.caseStudyId,
        );
        if (priorResponseCount < caseStudy.sequenceIndex - 1) {
          throw new BadRequestError(
            `Case ${caseStudy.sequenceIndex} is not yet unlocked. Submit your response to the previous case first.`,
          );
        }
      }
    }

    const responseId = await this.repository.createResponse(
      new CaseResponse({
        userId: input.userId,
        courseVersionId: caseStudy.courseVersionId.toString(),
        caseStudyId: input.caseStudyId,
        text,
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
      countWords(responseA.text),
      countWords(responseB.text),
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
      text: responseA.text,
      wordCount: countWords(responseA.text),
      outcome: 'A',
    };
    const viewB: ServedPairResponseView = {
      responseId: responseB._id!.toString(),
      text: responseB.text,
      wordCount: countWords(responseB.text),
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
   * Replace a response's text and start a fresh 7-review cycle.
   * Only callable when the response has reached the weak-streak threshold,
   * meaning the notification has already fired and the author has been
   * explicitly prompted to revise.
   */
  async reviseResponse(input: {
    userId: string;
    caseStudyId: string;
    text: string;
  }): Promise<{responseId: string}> {
    const text = input.text.trim();
    const wordCount = countWords(text);
    if (wordCount === 0) {
      throw new BadRequestError('A response cannot be empty.');
    }
    if (wordCount > CASE_STUDY_RESPONSE_MAX_WORDS) {
      throw new BadRequestError(
        `A response must be at most ${CASE_STUDY_RESPONSE_MAX_WORDS} words (this one is ${wordCount}).`,
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
      text,
    );
    if (!revised) {
      throw new BadRequestError('Revision failed. Your response may have already been approved by peers.');
    }
    return {responseId: existing._id!.toString()};
  }

  // ---------------------------------------------------------------------
  // Instructor / admin
  // ---------------------------------------------------------------------

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
