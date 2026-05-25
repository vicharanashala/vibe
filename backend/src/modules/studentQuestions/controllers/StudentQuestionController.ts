import {inject, injectable} from 'inversify';
import {
  Authorized,
  Body,
  CurrentUser,
  ForbiddenError,
  Get,
  HttpCode,
  JsonController,
  Params,
  Patch,
  Post,
  QueryParams,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {IUser} from '#root/shared/interfaces/models.js';
import {STUDENT_QUESTION_TYPES} from '../types.js';
import {StudentQuestionService} from '../services/StudentQuestionService.js';
import {
  CourseVersionStudentQuestionListQuery,
  CourseVersionStudentQuestionPathParams,
  CreateStudentQuestionBody,
  StudentQuestionCreateResponse,
  StudentQuestionListQuery,
  StudentQuestionListResponse,
  StudentQuestionPathParams,
  StudentQuestionStatusPathParams,
  UpdateStudentQuestionBody,
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
  ): Promise<StudentQuestionListResponse> {
    const questions = await this.service.listSegmentQuestions({
      courseId: params.courseId,
      courseVersionId: params.courseVersionId,
      segmentId: params.segmentId,
      limit: query.limit ?? 20,
    });
    return {
      items: questions.map(q => ({
        _id: q._id?.toString() || '',
        segmentId: q.segmentId.toString(),
        questionText: q.questionText,
        options: q.options.map(o => ({text: o.text})),
        correctOptionIndex: q.correctOptionIndex,
        status: q.status,
        source: q.source,
        createdBy: q.createdBy.toString(),
        createdAt: q.createdAt.toISOString(),
        reviewedBy: q.reviewedBy?.toString(),
        reviewedAt: q.reviewedAt?.toISOString(),
        rejectionReason: q.rejectionReason,
      })),
    };
  }

  @Authorized()
  @Get('/courses/:courseId/versions/:courseVersionId')
  @HttpCode(200)
  @ResponseSchema(StudentQuestionListResponse)
  async listByCourseVersion(
    @Params() params: CourseVersionStudentQuestionPathParams,
    @QueryParams() query: CourseVersionStudentQuestionListQuery,
  ): Promise<StudentQuestionListResponse> {
    const questions = await this.service.listCourseVersionQuestions({
      courseId: params.courseId,
      courseVersionId: params.courseVersionId,
      status: query.status,
      limit: query.limit ?? 100,
    });
    return {
      items: questions.map(q => ({
        _id: q._id?.toString() || '',
        segmentId: q.segmentId.toString(),
        questionText: q.questionText,
        options: q.options.map(o => ({text: o.text})),
        correctOptionIndex: q.correctOptionIndex,
        status: q.status,
        source: q.source,
        createdBy: q.createdBy.toString(),
        createdAt: q.createdAt.toISOString(),
        reviewedBy: q.reviewedBy?.toString(),
        reviewedAt: q.reviewedAt?.toISOString(),
        rejectionReason: q.rejectionReason,
      })),
    };
  }

  @Authorized()
  @Patch('/courses/:courseId/versions/:courseVersionId/segments/:segmentId/questions/:questionId')
  @HttpCode(200)
  async updateQuestion(
    @Params() params: StudentQuestionStatusPathParams,
    @Body() body: UpdateStudentQuestionBody,
    @CurrentUser() user: IUser,
  ): Promise<{success: true}> {
    const reviewedBy = user._id?.toString();
    if (!reviewedBy) {
      throw new ForbiddenError('Unable to resolve authenticated user.');
    }
    await this.service.updateQuestion({
      courseId: params.courseId,
      courseVersionId: params.courseVersionId,
      segmentId: params.segmentId,
      questionId: params.questionId,
      questionText: body.questionText,
      options: body.options,
      correctOptionIndex: body.correctOptionIndex,
      status: body.status,
      reason: body.reason,
      reviewedBy,
    });
    return {success: true};
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
