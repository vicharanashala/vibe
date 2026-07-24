import {inject, injectable} from 'inversify';
import {ObjectId} from 'mongodb';
import {BadRequestError, ForbiddenError, NotFoundError} from 'routing-controllers';
import {STUDENT_QUESTION_TYPES} from '../types.js';
import {StudentQuestionRepository} from '../repositories/providers/mongodb/StudentQuestionRepository.js';
import {
  IStudentQuestionOption,
  IStudentSegmentQuestion,
  StudentQuestionStatus,
  StudentQuestionType,
  StudentSegmentQuestion,
} from '../classes/transformers/StudentSegmentQuestion.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {ISettingRepository} from '#shared/database/index.js';
import {NOTIFICATIONS_TYPES} from '../../notifications/types.js';
import {NotificationService} from '../../notifications/services/NotificationService.js';
import {QUIZZES_TYPES} from '../../quizzes/types.js';
import {QuestionService} from '../../quizzes/services/QuestionService.js';
import {QuestionBankService} from '../../quizzes/services/QuestionBankService.js';
import {ItemRepository} from '#root/shared/database/providers/mongo/repositories/ItemRepository.js';
import {COURSES_TYPES} from '../../courses/types.js';
import {SOLQuestion} from '../../quizzes/classes/transformers/Question.js';
import {IQuizDetails, ItemType} from '#root/shared/interfaces/models.js';
import {ISOLSolution} from '#root/shared/interfaces/quiz.js';
import {isEligibleForReview} from './crowdGate.js';
import {ScreeningService, ScreeningResult} from './screening/ScreeningService.js';
import {SegmentContextProvider} from './context/SegmentContextProvider.js';
import {IScreeningVerdict} from '../classes/transformers/StudentSegmentQuestion.js';
import {screeningConfig} from '#root/config/screening.js';

const REPEATED_CHAR_PATTERN = /(.)\1{7,}/;
const REPEATED_WORD_PATTERN = /(\b\w+\b)(\s+\1){4,}/;
const URL_TOKEN_PATTERN = /^https?:\/\/\S+$/i;
const NOTIFICATION_QUESTION_PREVIEW_CHARS = 80;

/** Result of a submission after screening — drives the student-facing response. */
export interface CreateQuestionResult {
  decision: 'pass' | 'reject' | 'hold';
  reasonCode: string;
  message: string;
  /** Present unless rejected (no live record is kept for a reject beyond the stub). */
  questionId?: string;
  /** For a `typo` reject: the corrected question text the student can one-tap apply. */
  suggestedFix?: string;
}

@injectable()
export class StudentQuestionService {
  constructor(
    @inject(STUDENT_QUESTION_TYPES.StudentQuestionRepo)
    private readonly repository: StudentQuestionRepository,
    @inject(GLOBAL_TYPES.SettingRepo)
    private readonly settingRepo: ISettingRepository,
    @inject(NOTIFICATIONS_TYPES.NotificationService)
    private readonly notificationService: NotificationService,
    @inject(QUIZZES_TYPES.QuestionService)
    private readonly questionService: QuestionService,
    @inject(QUIZZES_TYPES.QuestionBankService)
    private readonly questionBankService: QuestionBankService,
    @inject(COURSES_TYPES.ItemRepo)
    private readonly itemRepo: ItemRepository,
    @inject(STUDENT_QUESTION_TYPES.ScreeningService)
    private readonly screeningService: ScreeningService,
    @inject(STUDENT_QUESTION_TYPES.SegmentContextProvider)
    private readonly segmentContextProvider: SegmentContextProvider,
  ) {}

  private async _stageToSubmittedBank(
    studentQuestionId: string,
    input: {
      segmentId: string;
      questionText: string;
      options: IStudentQuestionOption[];
      correctOptionIndex: number;
      createdBy: string;
    },
  ): Promise<void> {
    try {
      // `segmentId` is the VIDEO item the student just finished. The question
      // belongs to the quiz immediately following that video. We do NOT add it
      // to that quiz's GRADED bank — under the V3 crowd-question design
      // (CROWD_QUESTION_BANK.md) crowd questions are parked in a separate
      // "Submitted – Pending Validation" bank until peer-validated + instructor
      // approved, so they never enter graded quiz draws.
      const quizItem = await this._resolveTargetQuiz(input.segmentId);
      if (!quizItem) return;

      const gradedBankId = ((quizItem as any).details as IQuizDetails | undefined)
        ?.questionBankRefs?.[0]?.bankId?.toString();
      if (!gradedBankId) return;

      const solution: ISOLSolution = {
        correctLotItem: {
          text: input.options[input.correctOptionIndex].text,
          explaination: '',
        },
        incorrectLotItems: input.options
          .filter((_, i) => i !== input.correctOptionIndex)
          .map(opt => ({text: opt.text, explaination: ''})),
      };

      const solQuestion = new SOLQuestion(input.createdBy, {
        text: input.questionText,
        type: 'SELECT_ONE_IN_LOT',
        isParameterized: false,
        timeLimitSeconds: 60,
        priority: 'LOW',
        source: 'STUDENT_GENERATED',
        reviewStatus: 'PENDING_REVIEW',
        studentQuestionId,
      }, solution);

      const promotedId = await this.questionService.create(solQuestion);
      const submittedBankId =
        await this.questionBankService.findOrCreateCrowdSubmittedBank(
          gradedBankId,
          (quizItem as any)._id,
        );
      await this.questionBankService
        .addQuestion(submittedBankId, promotedId)
        .catch(e => console.warn('crowd-q: failed to add to submitted bank', e));
      await this.repository.setPromotedQuestionId(studentQuestionId, promotedId).catch(() => {});
    } catch (err) {
      console.warn('crowd-q: staging to submitted bank failed (non-fatal)', err);
    }
  }

  /**
   * Read-only view data for the teacher review screen: what segment is this
   * submission attached to, and which quiz would receive it on approval.
   *
   * Deliberately does NOT go through ItemService.readItem, which requires an
   * active enrollment — reviewing teachers are typically not enrolled in the
   * course they administer.
   */
  async getSegmentDetails(segmentId: string): Promise<{
    segmentId: string;
    name?: string;
    description?: string;
    type?: string;
    videoDetails?: {URL?: string; startTime?: string; endTime?: string; points?: number};
    quiz?: {itemId: string; name?: string};
  } | null> {
    const item: any = await this.itemRepo
      .readItemById(segmentId)
      .catch(() => null);
    if (!item) return null;

    const quizItem: any = await this._resolveTargetQuiz(segmentId);
    const details = item.details ?? {};

    return {
      segmentId,
      name: item.name,
      description: item.description,
      type: item.type,
      videoDetails:
        item.type === ItemType.VIDEO
          ? {
              URL: details.URL,
              startTime: details.startTime,
              endTime: details.endTime,
              points: details.points,
            }
          : undefined,
      quiz: quizItem
        ? {itemId: quizItem._id?.toString(), name: quizItem.name}
        : undefined,
    };
  }

  /**
   * Resolve the quiz whose question bank should receive a submission.
   *
   * Student questions are submitted at a video→quiz transition and stored
   * against the VIDEO item's id (`segmentId`). The target quiz is the item
   * immediately after that video in the same section's ordered item list.
   * If `segmentId` already points at a quiz, that quiz is used directly
   * (defensive: covers any caller that passes the quiz id).
   */
  private async _resolveTargetQuiz(segmentId: string): Promise<unknown | null> {
    const segmentItem = await this.itemRepo
      .readItemById(segmentId)
      .catch(() => null);
    if (!segmentItem) return null;
    if ((segmentItem as any).type === ItemType.QUIZ) return segmentItem;

    const group = await this.itemRepo
      .findItemsGroupByItemId(segmentId)
      .catch(() => null);
    const items = (group as any)?.items;
    if (!Array.isArray(items) || items.length === 0) return null;

    const ordered = [...items].sort((a, b) =>
      String(a.order).localeCompare(String(b.order)),
    );
    const index = ordered.findIndex(i => i?._id?.toString() === segmentId);
    if (index === -1 || index + 1 >= ordered.length) return null;

    const next = ordered[index + 1];
    if (!next || next.type !== ItemType.QUIZ) return null;

    const quizItem = await this.itemRepo
      .readItemById(next._id.toString())
      .catch(() => null);
    if (!quizItem || (quizItem as any).type !== ItemType.QUIZ) return null;
    return quizItem;
  }

  /**
   * Phase 4: emit an in-app notification to the question's author when a
   * teacher transitions status to APPROVED or REJECTED. Best-effort: errors
   * are logged but do not block the status update.
   */
  private async _notifyStatusChange(
    question: IStudentSegmentQuestion,
    nextStatus: StudentQuestionStatus,
    rejectionReason?: string,
  ): Promise<void> {
    if (nextStatus !== 'APPROVED' && nextStatus !== 'REJECTED') return;
    try {
      const preview = question.questionText.slice(
        0,
        NOTIFICATION_QUESTION_PREVIEW_CHARS,
      );
      const ellipsis =
        question.questionText.length > NOTIFICATION_QUESTION_PREVIEW_CHARS
          ? '...'
          : '';
      await this.notificationService.createNotification({
        userId: new ObjectId(question.createdBy.toString()),
        type:
          nextStatus === 'APPROVED'
            ? 'mcq_submission_approved'
            : 'mcq_submission_rejected',
        title:
          nextStatus === 'APPROVED'
            ? 'Your MCQ submission was approved'
            : 'Your MCQ submission was reviewed',
        message: `"${preview}${ellipsis}" — ${
          nextStatus === 'APPROVED' ? 'approved' : 'rejected'
        }`,
        courseId: new ObjectId(question.courseId.toString()),
        courseVersionId: new ObjectId(question.courseVersionId.toString()),
        read: false,
        createdAt: new Date(),
        extra: {
          studentQuestionId: question._id?.toString(),
          segmentId: question.segmentId.toString(),
          ...(nextStatus === 'REJECTED' && rejectionReason
            ? {rejectionReason}
            : {}),
        },
      });
    } catch (err) {
      // Best-effort: don't fail the status update if notification fails.
      console.error('Failed to emit student question notification', err);
    }
  }

  private normalize(text: string): string {
    return text.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  private validateQuestionText(questionText: string): string {
    const trimmed = questionText.trim();
    if (trimmed.length < 10 || trimmed.length > 300) {
      throw new BadRequestError(
        'Question must be between 10 and 300 characters.',
      );
    }

    const normalized = this.normalize(trimmed);
    const tokens = normalized.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      throw new BadRequestError('Question cannot be empty.');
    }

    if (tokens.every(token => URL_TOKEN_PATTERN.test(token))) {
      throw new BadRequestError('Question cannot contain only URLs.');
    }

    if (REPEATED_CHAR_PATTERN.test(normalized) || REPEATED_WORD_PATTERN.test(normalized)) {
      throw new BadRequestError('Question looks like spam. Please rewrite it.');
    }

    return trimmed;
  }

  private validateOptions(options: IStudentQuestionOption[]): IStudentQuestionOption[] {
    if (!Array.isArray(options) || options.length < 2 || options.length > 8) {
      throw new BadRequestError('MCQ must include between 2 and 8 options.');
    }
    return options.map((option, index) => {
      const text = option.text?.trim();
      if (!text) {
        throw new BadRequestError(`Option ${index + 1} text is required.`);
      }
      if (text.length > 150) {
        throw new BadRequestError(
          `Option ${index + 1} text must be 150 characters or fewer.`,
        );
      }
      return {text};
    });
  }

  private buildSignature(input: {
    questionText: string;
    options: IStudentQuestionOption[];
    correctOptionIndex: number;
  }): string {
    const optionSig = input.options
      .map(o => this.normalize(o.text))
      .join('|');
    return [
      this.normalize(input.questionText),
      optionSig,
      String(input.correctOptionIndex),
    ].join('||');
  }

  private async ensureSubmissionEnabled(
    courseId: string,
    courseVersionId: string,
  ): Promise<void> {
    const courseSettings = await this.settingRepo.readCourseSettings(
      courseId,
      courseVersionId,
    );
    const enabled =
      courseSettings?.settings?.crowdsourcedQuestionSubmissionEnabled === true;
    if (!enabled) {
      throw new ForbiddenError(
        'Question submission is not enabled for this course version.',
      );
    }
  }

  async createQuestion(input: {
    courseId: string;
    courseVersionId: string;
    segmentId: string;
    questionType: StudentQuestionType;
    questionText: string;
    options: IStudentQuestionOption[];
    correctOptionIndex: number;
    createdBy: string;
  }): Promise<CreateQuestionResult> {
    await this.ensureSubmissionEnabled(input.courseId, input.courseVersionId);

    if (input.questionType !== 'SELECT_ONE_IN_LOT') {
      throw new BadRequestError(
        'Only single-answer MCQ submissions are supported.',
      );
    }

    const questionText = this.validateQuestionText(input.questionText);
    const options = this.validateOptions(input.options);

    if (
      !Number.isInteger(input.correctOptionIndex) ||
      input.correctOptionIndex < 0 ||
      input.correctOptionIndex >= options.length
    ) {
      throw new BadRequestError('Correct option index is out of range.');
    }

    const normalizedSignature = this.buildSignature({
      questionText,
      options,
      correctOptionIndex: input.correctOptionIndex,
    });

    // Exact-resubmit guard (free, idempotent): identical content on this segment
    // is a definite duplicate — reject without spending an LLM call.
    const exact = await this.repository.findDuplicate({
      courseVersionId: input.courseVersionId,
      segmentId: input.segmentId,
      normalizedSignature,
    });
    if (exact) {
      return {
        decision: 'reject',
        reasonCode: 'duplicate',
        message: 'You have already submitted this exact question for this lesson. Try asking about something different.',
      };
    }

    // AI screening: build the dedup reference pool + lesson context (relevance),
    // then run the ordered short-circuiting checks. The pool is every prior
    // question for this segment the new one could duplicate: existing student
    // submissions (PENDING/HELD/APPROVED) AND the graded question bank, merged
    // and de-duplicated. Comparing against pending submissions — not just
    // approved/graded ones — is what catches a repeat before any teacher acts.
    const [gradedPool, submissionPool] = await Promise.all([
      this.fetchGradedPool(input.segmentId),
      this.fetchSubmissionPool({
        courseId: input.courseId,
        courseVersionId: input.courseVersionId,
        segmentId: input.segmentId,
      }),
    ]);
    const existingQuestions = this.mergePool(gradedPool, submissionPool);

    // Lesson context for the on-topic + answer-correctness checks. Layered:
    // precomputed transcript when available, else the graded stems we just
    // fetched (as a proxy), else null. Fail-open — never blocks a submission.
    //
    // ON HOLD: context (relevance) checking is disabled until real per-segment
    // transcripts exist — the graded-stem proxy is too weak a relevance signal
    // and would risk false off-topic rejections. When context is null the
    // ScreeningService skips the on-topic gate and runs answer-correctness on
    // model knowledge. Flip SCREENING_CONTEXT_ENABLED=true to re-enable (that
    // also grounds the answer check in the lesson). See CROWD_QUESTION_BANK.md.
    const context = screeningConfig.contextCheckEnabled
      ? await this.segmentContextProvider.getContext({
          segmentId: input.segmentId,
          courseVersionId: input.courseVersionId,
          gradedStems: gradedPool,
        })
      : null;

    const verdict = await this.screeningService.screen({
      questionText,
      options: options.map(o => o.text),
      correctOptionIndex: input.correctOptionIndex,
      existingQuestions,
      context,
    });

    const persisted = this.toPersistedVerdict(verdict);

    // pass → live PENDING; hold → HELD (awaits instructor); reject → rejected stub.
    const status: StudentQuestionStatus =
      verdict.decision === 'pass' ? 'PENDING' : verdict.decision === 'hold' ? 'HELD' : 'REJECTED';

    const question = new StudentSegmentQuestion({
      courseId: input.courseId,
      courseVersionId: input.courseVersionId,
      segmentId: input.segmentId,
      questionType: input.questionType,
      questionText,
      options,
      correctOptionIndex: input.correctOptionIndex,
      normalizedSignature,
      createdBy: input.createdBy,
      status,
      screening: persisted,
      rejectionReason: verdict.decision === 'reject' ? verdict.reasonCode : undefined,
    });

    const createdId = await this.repository.create(question);

    // Only a clean PASS enters the served/collecting pool.
    if (verdict.decision === 'pass') {
      await this._stageToSubmittedBank(createdId, {
        segmentId: input.segmentId,
        questionText,
        options,
        correctOptionIndex: input.correctOptionIndex,
        createdBy: input.createdBy,
      });
    }

    return {
      decision: verdict.decision,
      reasonCode: verdict.reasonCode,
      message: verdict.message,
      questionId: verdict.decision === 'reject' ? undefined : createdId,
      ...(verdict.suggestedFix ? {suggestedFix: verdict.suggestedFix} : {}),
    };
  }

  /** Map the transient screening result to the persisted verdict subdocument. */
  private toPersistedVerdict(v: ScreeningResult): IScreeningVerdict {
    return {
      decision: v.decision,
      reasonCode: v.reasonCode,
      check: v.check,
      message: v.message,
      checks: v.checks,
      matchQuestion: v.matchQuestion,
      provider: v.provider,
      model: v.model,
      latencyMs: v.latencyMs,
      at: new Date(),
    };
  }

  /**
   * The duplicate-check reference pool: existing question stems in the segment's
   * graded question bank. Best-effort — any failure yields an empty pool (screen
   * still runs the other checks). No new query engine; reuses existing services.
   */
  private async fetchGradedPool(segmentId: string): Promise<string[]> {
    try {
      const quizItem = await this._resolveTargetQuiz(segmentId);
      const bankRef = (quizItem as any)?.details?.questionBankRefs?.[0];
      if (!bankRef) return [];
      // NOTE: getQuestions() honours the ref's `count` (a random draw the quiz
      // shows the learner — often 1-5), not the whole bank. For dedup we need
      // EVERY stem in the bank, so override count to the dedup pool limit.
      const ids = await this.questionBankService.getQuestions({
        ...bankRef,
        count: screeningConfig.dedupPoolLimit,
      });
      const questions = await Promise.all(
        ids.map(id => this.questionService.getByIdWithoutExplanation(id, true).catch(() => null)),
      );
      const stems = questions
        .map(q => (q as any)?.text)
        .filter((t: unknown): t is string => typeof t === 'string' && t.trim().length > 0);
      return stems;
    } catch {
      return [];
    }
  }

  /**
   * Existing student submissions for this segment that a new one could
   * duplicate — PENDING, HELD or APPROVED (rejected stubs are ignored so a
   * student can retry a fixed version). Returns their question stems.
   */
  private async fetchSubmissionPool(input: {
    courseId: string;
    courseVersionId: string;
    segmentId: string;
  }): Promise<string[]> {
    try {
      const existing = await this.repository.listBySegment({
        ...input,
        limit: screeningConfig.dedupPoolLimit,
      });
      return existing
        .filter(q => q.status !== 'REJECTED')
        .map(q => q.questionText)
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0);
    } catch {
      return [];
    }
  }

  /** Merge dedup sources, drop case/space-insensitive repeats, cap at the pool limit. */
  private mergePool(...sources: string[][]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const stem of sources.flat()) {
      const key = this.normalize(stem);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(stem);
      if (out.length >= screeningConfig.dedupPoolLimit) break;
    }
    return out;
  }

  /**
   * Stage-2 capture: record one student's ungraded response (answer correctness
   * + optional 👍/👎) to a served crowd question, then evaluate the promotion
   * gate. Idempotent per (question, student). When the gate passes, flips the
   * question to ELIGIBLE so it surfaces in the instructor review queue.
   * Best-effort: never throws into the quiz-submission path.
   */
  async recordPeerResponse(input: {
    studentQuestionId: string;
    userId: string;
    isCorrect: boolean;
    thumb?: 'UP' | 'DOWN';
  }): Promise<void> {
    try {
      const counters = await this.repository.recordCrowdResponse(input);
      if (!counters) return; // already responded — no double count
      if (isEligibleForReview(counters)) {
        await this.repository.markEligible(input.studentQuestionId);
      }
    } catch (err) {
      console.warn('crowd-q: failed to record peer response', err);
    }
  }

  async listSegmentQuestions(input: {
    courseId: string;
    courseVersionId: string;
    segmentId: string;
    limit: number;
  }) {
    return await this.repository.listBySegment(input);
  }

  async listCourseVersionQuestions(input: {
    courseId: string;
    courseVersionId: string;
    status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';
    limit: number;
  }) {
    const repoStatus =
      input.status && input.status !== 'ALL' ? input.status : undefined;
    return await this.repository.listByCourseVersion({
      courseId: input.courseId,
      courseVersionId: input.courseVersionId,
      status: repoStatus,
      limit: input.limit,
    });
  }

  async updateQuestion(input: {
    courseId: string;
    courseVersionId: string;
    segmentId: string;
    questionId: string;
    questionText?: string;
    options?: {text: string}[];
    correctOptionIndex?: number;
    status?: StudentQuestionStatus;
    reason?: string;
    reviewedBy: string;
  }): Promise<void> {
    const existing = await this.repository.findById({
      courseId: input.courseId,
      courseVersionId: input.courseVersionId,
      segmentId: input.segmentId,
      questionId: input.questionId,
    });
    if (!existing) {
      throw new NotFoundError('Student question not found for the given segment.');
    }
    if (existing.status !== 'PENDING') {
      throw new ForbiddenError(
        'Only PENDING questions can be edited.',
      );
    }

    const hasContentChange =
      input.questionText !== undefined ||
      input.options !== undefined ||
      input.correctOptionIndex !== undefined;

    if (!hasContentChange && !input.status) {
      throw new BadRequestError(
        'Nothing to update. Provide question content fields and/or a status.',
      );
    }

    const nextQuestionText = this.validateQuestionText(
      input.questionText ?? existing.questionText,
    );
    const nextOptions = this.validateOptions(
      input.options ?? existing.options,
    );
    const nextCorrectIndex =
      input.correctOptionIndex !== undefined
        ? input.correctOptionIndex
        : existing.correctOptionIndex;
    if (
      !Number.isInteger(nextCorrectIndex) ||
      nextCorrectIndex < 0 ||
      nextCorrectIndex >= nextOptions.length
    ) {
      throw new BadRequestError('Correct option index is out of range.');
    }

    const nextSignature = this.buildSignature({
      questionText: nextQuestionText,
      options: nextOptions,
      correctOptionIndex: nextCorrectIndex,
    });

    if (nextSignature !== existing.normalizedSignature) {
      const duplicate = await this.repository.findDuplicateExcluding({
        courseVersionId: input.courseVersionId,
        segmentId: input.segmentId,
        normalizedSignature: nextSignature,
        excludeQuestionId: input.questionId,
      });
      if (duplicate) {
        throw new BadRequestError(
          'A similar question already exists for this segment.',
        );
      }
    }

    let statusTransition:
      | {status: StudentQuestionStatus; reviewedBy: string; rejectionReason?: string}
      | undefined;
    if (input.status) {
      if (input.status === 'REJECTED') {
        const reason = input.reason?.trim();
        if (!reason || reason.length < 3 || reason.length > 500) {
          throw new BadRequestError(
            'A rejection reason of 3 to 500 characters is required.',
          );
        }
        statusTransition = {
          status: 'REJECTED',
          reviewedBy: input.reviewedBy,
          rejectionReason: reason,
        };
      } else {
        statusTransition = {
          status: input.status,
          reviewedBy: input.reviewedBy,
        };
      }
    }

    const matched = await this.repository.updateContent({
      courseId: input.courseId,
      courseVersionId: input.courseVersionId,
      segmentId: input.segmentId,
      questionId: input.questionId,
      questionText: nextQuestionText,
      options: nextOptions,
      correctOptionIndex: nextCorrectIndex,
      normalizedSignature: nextSignature,
      statusTransition,
    });
    if (!matched) {
      throw new NotFoundError('Student question not found for the given segment.');
    }

    if (statusTransition) {
      await this._notifyStatusChange(
        existing,
        statusTransition.status,
        statusTransition.rejectionReason,
      );
    }
  }

  async updateQuestionStatus(input: {
    courseId: string;
    courseVersionId: string;
    segmentId: string;
    questionId: string;
    status: StudentQuestionStatus;
    reviewedBy: string;
    reason?: string;
  }): Promise<void> {
    if (input.status === 'REJECTED') {
      const reason = input.reason?.trim();
      if (!reason || reason.length < 3 || reason.length > 500) {
        throw new BadRequestError(
          'A rejection reason of 3 to 500 characters is required.',
        );
      }
    }

    const matched = await this.repository.updateStatus({
      courseId: input.courseId,
      courseVersionId: input.courseVersionId,
      segmentId: input.segmentId,
      questionId: input.questionId,
      status: input.status,
      reviewedBy: input.reviewedBy,
      rejectionReason: input.reason?.trim(),
    });
    if (!matched) {
      throw new NotFoundError('Student question not found for the given segment.');
    }

    // Fetch fresh doc for notifications and promotion sync.
    if (input.status === 'APPROVED' || input.status === 'REJECTED') {
      const question = await this.repository.findById({
        courseId: input.courseId,
        courseVersionId: input.courseVersionId,
        segmentId: input.segmentId,
        questionId: input.questionId,
      });
      if (question) {
        await this._notifyStatusChange(
          question,
          input.status,
          input.reason?.trim(),
        );
        // Sync the linked quiz Question.
        if (question.promotedQuestionId) {
          const promotedId = question.promotedQuestionId.toString();
          if (input.status === 'APPROVED') {
            // Mark approved AND move it from the "Submitted – Pending
            // Validation" bank into the quiz's graded bank so it counts toward
            // grading. Both are best-effort and must not fail the status update.
            await this.questionService.setReviewStatus(promotedId, 'APPROVED').catch(e =>
              console.warn('crowd-q: failed to approve quiz question', e),
            );
            await this.questionBankService
              .promoteSubmittedQuestionToGraded(promotedId)
              .catch(e =>
                console.warn('crowd-q: failed to move approved question to graded bank', e),
              );
          } else {
            await this.questionService.delete(promotedId).catch(e =>
              console.warn('crowd-q: failed to delete quiz question', e),
            );
          }
        }
      }
    }
  }

  async listMyQuestions(input: {
    userId: string;
    status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';
    limit: number;
  }) {
    const repoStatus =
      input.status && input.status !== 'ALL' ? input.status : undefined;
    return await this.repository.listByUserId({
      userId: input.userId,
      status: repoStatus,
      limit: input.limit,
    });
  }
}
