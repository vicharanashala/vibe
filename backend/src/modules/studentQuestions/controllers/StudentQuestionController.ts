import {inject, injectable} from 'inversify';
import {
  Authorized,
  Body,
  CurrentUser,
  ForbiddenError,
  Get,
  HttpCode,
  JsonController,
  Patch,
  Params,
  Post,
  QueryParams,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {IUser} from '#root/shared/interfaces/models.js';
import {STUDENT_QUESTION_TYPES} from '../types.js';
import {StudentQuestionService} from '../services/StudentQuestionService.js';
import {
  CreateStudentQuestionBody,
  StudentQuestionCreateResponse,
  StudentQuestionListQuery,
  StudentQuestionListResponse,
  StudentQuestionPathParams,
  StudentQuestionStatusPathParams,
  UpdateStudentQuestionStatusBody,
} from '../classes/validators/StudentQuestionValidator.js';

@OpenAPI({
  tags: ['Student Questions'],
})
@JsonController('/student-questions')
@injectable()
export class StudentQuestionController {
  constructor(
    @inject(STUDENT_QUESTION_TYPES.StudentQuestionService)
    private readonly service: StudentQuestionService,
  ) {}

  @Authorized()
  @Post('/courses/:courseId/versions/:courseVersionId/segments/:segmentId')
  @HttpCode(201)
  @ResponseSchema(StudentQuestionCreateResponse)
  async create(
    @Params() params: StudentQuestionPathParams,
    @Body() body: CreateStudentQuestionBody,
    @CurrentUser() user: IUser,
  ): Promise<StudentQuestionCreateResponse> {
    const createdBy = user._id?.toString();
    if (!createdBy) {
      throw new ForbiddenError('Unable to resolve authenticated user.');
    }

    const questionId = await this.service.createQuestion({
      courseId: params.courseId,
      courseVersionId: params.courseVersionId,
      segmentId: params.segmentId,
      questionType: body.questionType,
      questionText: body.questionText,
      questionImageUrl: body.questionImageUrl,
      options: body.options,
      correctOptionIndex: body.correctOptionIndex,
      createdBy,
    });

    return {questionId};
  }

  @Authorized()
  @Get('/courses/:courseId/versions/:courseVersionId/segments/:segmentId')
  @HttpCode(200)
  @ResponseSchema(StudentQuestionListResponse)
  async listBySegment(
    @Params() params: StudentQuestionPathParams,
    @QueryParams() query: StudentQuestionListQuery,
    @CurrentUser() _user: IUser,
  ): Promise<StudentQuestionListResponse> {
    const questions = await this.service.listSegmentQuestions({
      courseId: params.courseId,
      courseVersionId: params.courseVersionId,
      segmentId: params.segmentId,
      limit: query.limit ?? 20,
    });

    return {
      items: questions.map(question => ({
        _id: question._id?.toString() || '',
        questionType: question.questionType,
        questionText: question.questionText,
        questionImageUrl: question.questionImageUrl,
        options: question.options,
        correctOptionIndex: question.correctOptionIndex,
        status: question.status,
        source: question.source,
        createdBy: question.createdBy.toString(),
        createdAt: question.createdAt.toISOString(),
        rejectionReason: question.rejectionReason,
        reviewedBy: question.reviewedBy?.toString(),
        reviewedAt: question.reviewedAt?.toISOString(),
      })),
    };
  }

  @Authorized()
  @Patch('/courses/:courseId/versions/:courseVersionId/segments/:segmentId/questions/:questionId/status')
  @HttpCode(200)
  async updateStatus(
    @Params() params: StudentQuestionStatusPathParams,
    @Body() body: UpdateStudentQuestionStatusBody,
    @CurrentUser() user: IUser,
  ): Promise<{success: true}> {
    const reviewedBy = user._id?.toString();
    if (!reviewedBy) {
      throw new ForbiddenError('Unable to resolve authenticated user.');
    }

    await this.service.updateQuestionStatus({
      courseId: params.courseId,
      courseVersionId: params.courseVersionId,
      segmentId: params.segmentId,
      questionId: params.questionId,
      status: body.status,
      reviewedBy,
      reason: body.reason,
    });

    return {success: true};
  }
}
