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

const REPEATED_CHAR_PATTERN = /(.)\1{7,}/;
const REPEATED_WORD_PATTERN = /(\b\w+\b)(\s+\1){4,}/;
const URL_TOKEN_PATTERN = /^https?:\/\/\S+$/i;
const NOTIFICATION_QUESTION_PREVIEW_CHARS = 80;

@injectable()
export class StudentQuestionService {
  constructor(
    @inject(STUDENT_QUESTION_TYPES.StudentQuestionRepo)
    private readonly repository: StudentQuestionRepository,
    @inject(GLOBAL_TYPES.SettingRepo)
    private readonly settingRepo: ISettingRepository,
    @inject(NOTIFICATIONS_TYPES.NotificationService)
    private readonly notificationService: NotificationService,
  ) {}

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
  }): Promise<string> {
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

    const duplicate = await this.repository.findDuplicate({
      courseVersionId: input.courseVersionId,
      segmentId: input.segmentId,
      normalizedSignature,
    });
    if (duplicate) {
      throw new BadRequestError(
        'A similar question already exists for this segment.',
      );
    }

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
    });

    return await this.repository.create(question);
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

    // Notify the student author on APPROVED / REJECTED. Fetch fresh so we
    // have createdBy / segmentId / courseId for the notification payload.
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
