import {inject, injectable} from 'inversify';
import {ForbiddenError, BadRequestError, NotFoundError} from 'routing-controllers';
import {STUDENT_QUESTION_TYPES} from '../types.js';
import {StudentQuestionRepository} from '../repositories/providers/mongodb/StudentQuestionRepository.js';
import {
  IStudentQuestionOption,
  StudentQuestionType,
  StudentSegmentQuestion,
} from '../classes/transformers/StudentSegmentQuestion.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {ISettingRepository} from '#shared/database/index.js';

const PROFANITY_LIST = [
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'nigger',
  'slut',
  'whore',
];

@injectable()
export class StudentQuestionService {
  constructor(
    @inject(STUDENT_QUESTION_TYPES.StudentQuestionRepo)
    private readonly repository: StudentQuestionRepository,
    @inject(GLOBAL_TYPES.SettingRepo)
    private readonly settingRepo: ISettingRepository,
  ) {}

  private normalizeQuestionText(questionText: string): string {
    return questionText.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  private validateImageReference(imageUrl: string, fieldName: string): string {
    const trimmed = imageUrl.trim();

    if (!trimmed) {
      throw new BadRequestError(`${fieldName} cannot be empty.`);
    }

    const isHttpUrl = /^https?:\/\/\S+$/i.test(trimmed);
    const isDataUrl = /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(trimmed);

    if (!isHttpUrl && !isDataUrl) {
      throw new BadRequestError(
        `${fieldName} must be a valid image URL or data URL.`,
      );
    }

    return trimmed;
  }

  private validateQuestionText(questionText: string): string {
    const normalized = this.normalizeQuestionText(questionText);

    if (normalized.length < 10 || normalized.length > 300) {
      throw new BadRequestError('Question must be between 10 and 300 characters.');
    }

    if (/^(https?:\/\/\S+\s*)+$/.test(normalized)) {
      throw new BadRequestError('Question cannot contain only URLs.');
    }

    if (/(.)\1{7,}/.test(normalized) || /(\b\w+\b)(\s+\1){4,}/.test(normalized)) {
      throw new BadRequestError('Question looks like spam. Please rewrite it.');
    }

    if (PROFANITY_LIST.some(word => normalized.includes(word))) {
      throw new BadRequestError('Question contains inappropriate language.');
    }

    return normalized;
  }

  private validateOption(option: IStudentQuestionOption, index: number): IStudentQuestionOption {
    const text = option.text?.trim();
    const imageUrl = option.imageUrl?.trim();

    if (!text) {
      throw new BadRequestError(
        `Option ${index + 1} must include text.`,
      );
    }

    if (text && text.length > 150) {
      throw new BadRequestError(
        `Option ${index + 1} text must be 150 characters or fewer.`,
      );
    }

    return {
      text,
      ...(imageUrl
        ? {imageUrl: this.validateImageReference(imageUrl, `Option ${index + 1} image`) }
        : {}),
    };
  }

  private normalizeQuestionSignature(input: {
    questionText: string;
    questionImageUrl?: string;
    options: IStudentQuestionOption[];
    correctOptionIndex: number;
  }): string {
    const optionSignature = input.options
      .map(option => {
        const normalizedText = option.text
          ? this.normalizeQuestionText(option.text)
          : '';
        const normalizedImage = option.imageUrl?.trim().toLowerCase() || '';
        return `${normalizedText}::${normalizedImage}`;
      })
      .join('|');

    return [
      this.normalizeQuestionText(input.questionText),
      input.questionImageUrl?.trim().toLowerCase() || '',
      optionSignature,
      String(input.correctOptionIndex),
    ].join('||');
  }

  private async ensureSubmissionEnabled(courseId: string, courseVersionId: string): Promise<void> {
    const courseSettings = await this.settingRepo.readCourseSettings(courseId, courseVersionId);
    const isEnabled =
      courseSettings?.settings?.crowdsourcedQuestionSubmissionEnabled === true;

    if (!isEnabled) {
      throw new ForbiddenError('Question submission is not enabled for this course version.');
    }
  }

  async createQuestion(input: {
    courseId: string;
    courseVersionId: string;
    segmentId: string;
    questionType: StudentQuestionType;
    questionText: string;
    questionImageUrl?: string;
    options: IStudentQuestionOption[];
    correctOptionIndex: number;
    createdBy: string;
  }): Promise<string> {
    await this.ensureSubmissionEnabled(input.courseId, input.courseVersionId);

    if (input.questionType !== 'SELECT_ONE_IN_LOT') {
      throw new BadRequestError('Only single-answer MCQ submissions are supported.');
    }

    if (!Array.isArray(input.options) || input.options.length < 2 || input.options.length > 8) {
      throw new BadRequestError('MCQ submissions must include between 2 and 8 options.');
    }

    const questionText = input.questionText.trim();
    this.validateQuestionText(questionText);
    const questionImageUrl = input.questionImageUrl?.trim()
      ? this.validateImageReference(input.questionImageUrl, 'Question image')
      : undefined;
    const options = input.options.map((option, index) =>
      this.validateOption(option, index),
    );

    if (
      input.correctOptionIndex < 0 ||
      input.correctOptionIndex >= options.length
    ) {
      throw new BadRequestError('Correct option index is out of range.');
    }

    const normalizedQuestionSignature = this.normalizeQuestionSignature({
      questionText,
      questionImageUrl,
      options,
      correctOptionIndex: input.correctOptionIndex,
    });

    const duplicate = await this.repository.findDuplicate({
      courseVersionId: input.courseVersionId,
      segmentId: input.segmentId,
      normalizedQuestionText: normalizedQuestionSignature,
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
      questionImageUrl,
      options,
      correctOptionIndex: input.correctOptionIndex,
      normalizedQuestionText: normalizedQuestionSignature,
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

  async updateQuestionStatus(input: {
    courseId: string;
    courseVersionId: string;
    segmentId: string;
    questionId: string;
    status: 'UNVERIFIED' | 'TO_BE_VALIDATED' | 'VALIDATED' | 'REJECTED';
    reviewedBy: string;
    reason?: string;
  }): Promise<void> {
    const allowedStatuses = ['UNVERIFIED', 'TO_BE_VALIDATED', 'VALIDATED', 'REJECTED'];
    if (!allowedStatuses.includes(input.status)) {
      throw new BadRequestError('Invalid student question status.');
    }

    if (input.status === 'REJECTED') {
      const reason = input.reason?.trim();
      if (!reason || reason.length < 3) {
        throw new BadRequestError('A rejection reason of at least 3 characters is required.');
      }
      if (reason.length > 500) {
        throw new BadRequestError('Rejection reason must be 500 characters or fewer.');
      }
    }

    const updated = await this.repository.updateStatus({
      courseId: input.courseId,
      courseVersionId: input.courseVersionId,
      segmentId: input.segmentId,
      questionId: input.questionId,
      status: input.status,
      reviewedBy: input.reviewedBy,
      rejectionReason: input.reason,
    });
    if (!updated) {
      throw new NotFoundError('Student question not found for the given segment.');
    }
  }
}
