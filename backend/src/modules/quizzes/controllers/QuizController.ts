import {QuestionBankRef} from '#quizzes/classes/validators/QuestionBankValidator.js';
import {
  QuizIdParam,
  AddQuestionBankBody,
  RemoveQuestionBankParams,
  EditQuestionBankBody,
  GetUserMatricesParams,
  UserQuizMetricsResponse,
  QuizAttemptParam,
  QuizAttemptResponse,
  QuizSubmissionParam,
  QuizSubmissionResponse,
  QuizDetailsResponse,
  QuizAnalyticsResponse,
  QuizPerformanceResponse,
  QuizResultsResponse,
  FlaggedQuestionResponse,
  UpdateQuizSubmissionParam,
  RegradeSubmissionBody,
  AddFeedbackParams,
  AddFeedbackBody,
  GetAllSubmissionsResponse,
  QuizNotFoundErrorResponse,
  GetAllQuestionBanksResponse,
  GetQuizSubmissionsQuery,
} from '#quizzes/classes/validators/QuizValidator.js';
import {Ability} from '#root/shared/functions/AbilityDecorator.js';
import {QuizService} from '#quizzes/services/QuizService.js';
import {injectable, inject} from 'inversify';
import {
  JsonController,
  Post,
  HttpCode,
  Params,
  Body,
  Delete,
  Get,
  OnUndefined,
  Patch,
  BadRequestError,
  ForbiddenError,
  Authorized,
  QueryParams,
  UseInterceptor,
  Req,
  QueryParam,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {QUIZZES_TYPES} from '#quizzes/types.js';
import {
  ISubmission,
  ISubmissionWithUser,
  PaginatedSubmissions,
} from '#quizzes/interfaces/index.js';
import {QuizActions, getQuizAbility} from '../abilities/quizAbilities.js';
import {subject} from '@casl/ability';
import {COURSES_TYPES} from '#root/modules/courses/types.js';
import {ItemService} from '#root/modules/courses/services/ItemService.js';
import { BadRequestErrorResponse} from '#root/shared/index.js';
import { AuditTrailsHandler } from '#root/shared/middleware/auditTrails.js';
import {CourseIdParams} from '#root/modules/courses/classes/index.js';
import { setAuditTrail } from '#root/utils/setAuditTrail.js';
import { AuditAction, AuditCategory, OutComeStatus } from '#root/modules/auditTrails/interfaces/IAuditTrails.js';
import { ObjectId } from 'mongodb';
import { QuestionBankService } from '../services/QuestionBankService.js';

@OpenAPI({
  tags: ['Quiz'],
})
@injectable()
@JsonController('/quizzes/quiz')
class QuizController {
  constructor(
    @inject(QUIZZES_TYPES.QuizService)
    private readonly quizService: QuizService,

    @inject(COURSES_TYPES.ItemService)
    private readonly itemService: ItemService,

    @inject(QUIZZES_TYPES.QuestionBankService)
    private readonly questionBankService: QuestionBankService
  ) {}

  @OpenAPI({
    summary: 'Add a question bank to a quiz',
    description: `Associates a question bank with a quiz.<br/>
    It returns an empty body with a 200 status code.`,
  })
  @Authorized()
  @Post('/:quizId/bank')
  @OnUndefined(200)
  @ResponseSchema(QuizNotFoundErrorResponse, {
    description: 'Quiz not found',
    statusCode: 404,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid request body or parameters',
    statusCode: 400,
  })
  async addQuestionBank(
    @Params() params: QuizIdParam,
    @Body() body: AddQuestionBankBody,
    @Ability(getQuizAbility) {ability},
  ) {
    const {quizId} = params;
    const courseInfo = await this.itemService.getCourseAndVersionByItemId(
      quizId,
    );
    // Build the subject context first
    const quizSubject = subject('Quiz', {
      courseId: courseInfo.courseId,
      versionId: courseInfo.versionId,
    });

    if (!ability.can(QuizActions.ModifyBank, quizSubject)) {
      throw new ForbiddenError(
        'You do not have permission to modify quiz question banks',
      );
    }


    await this.quizService.addQuestionBank(quizId, body);
  }

  @OpenAPI({
    summary: 'Remove a question bank from a quiz',
    description: `Removes the association of a question bank from a quiz.<br/>
    It returns an empty body with a 200 status code.`,
  })
  @Authorized()
  @Delete('/:quizId/bank/:questionBankId')
  @UseInterceptor(AuditTrailsHandler)
  @OnUndefined(200)
  @ResponseSchema(QuizNotFoundErrorResponse, {
    description: 'Quiz or question bank not found',
    statusCode: 404,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid request parameters',
    statusCode: 400,
  })
  async removeQuestionBank(
    @Params() params: RemoveQuestionBankParams,
    @Ability(getQuizAbility) {ability, user},
    @Req() req: Request
  ) {
    const {quizId, questionBankId} = params;
    const courseInfo = await this.itemService.getCourseAndVersionByItemId(
      quizId,
    );
    // Build the subject context first
    const quizSubject = subject('Quiz', {
      courseId: courseInfo.courseId,
      versionId: courseInfo.versionId,
    });

    if (!ability.can(QuizActions.ModifyBank, quizSubject)) {
      throw new ForbiddenError(
        'You do not have permission to modify quiz question banks',
      );
    }

    const getBank = await this.quizService.getAllQuestionBanks(quizId);
    
    const bankToRemove = getBank.find(bank => bank.bankId.toString() === questionBankId);

      setAuditTrail(req, {
        category: AuditCategory.QUESTION_BANK,
        action: AuditAction.QUESTION_BANK_DELETE,
        actor: {
          id: ObjectId.createFromHexString(user._id.toString()),
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          role: user.roles,
        },
        context: {
            courseId: ObjectId.createFromHexString(courseInfo.courseId.toString()),
            courseVersionId: ObjectId.createFromHexString(courseInfo.versionId.toString()),
            quizId: ObjectId.createFromHexString(quizId.toString()),
        },
        changes:{
          before:{
            bankId: ObjectId.createFromHexString(questionBankId.toString()),
            count: bankToRemove.count,
            difficulty: bankToRemove.difficulty,
            tags: bankToRemove.tags,
          }
        },
        outcome:{
          status: OutComeStatus.SUCCESS
        }

      })

    await this.quizService.removeQuestionBank(quizId, questionBankId);
  }

  @OpenAPI({
    summary: 'Edit question bank configuration for a quiz',
    description: `Updates the configuration of a question bank within a quiz.<br/>
    It returns an empty body with a 200 status code.`,
  })
  @Authorized()
  @Patch('/:quizId/bank')
  @UseInterceptor(AuditTrailsHandler)
  @OnUndefined(200)
  @ResponseSchema(QuizNotFoundErrorResponse, {
    description: 'Quiz not found',
    statusCode: 404,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid request body or parameters',
    statusCode: 400,
  })
  async editQuestionBank(
    @Params() params: QuizIdParam,
    @Body() body: EditQuestionBankBody,
    @Ability(getQuizAbility) {ability, user},
    @Req() req: Request
  ) {
    const {quizId} = params;
    const courseInfo = await this.itemService.getCourseAndVersionByItemId(
      quizId,
    );
    // Build the subject context first
    const quizSubject = subject('Quiz', {
      courseId: courseInfo.courseId,
      versionId: courseInfo.versionId,
    });

    if (!ability.can(QuizActions.ModifyBank, quizSubject)) {
      throw new ForbiddenError(
        'You do not have permission to modify quiz question banks',
      );
    }

    const existingQuestionBank = await this.quizService.getAllQuestionBanks(quizId);

    const questionBankToEdit = existingQuestionBank.find(qb => qb.bankId.toString() === body.bankId);

    setAuditTrail(req, {
      category: AuditCategory.QUESTION_BANK,
      action: AuditAction.QUESTION_BANK_UPDATE,
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
      context: {
          courseId: ObjectId.createFromHexString(courseInfo.courseId.toString()),
          courseVersionId: ObjectId.createFromHexString(courseInfo.versionId.toString()),
          quizId: ObjectId.createFromHexString(quizId.toString()),
         
      },
      changes:{
        before:{
          bankId: ObjectId.createFromHexString(body.bankId.toString()),
          count: questionBankToEdit.count,
          difficulty: questionBankToEdit.difficulty,
          tags: questionBankToEdit.tags,
        },
        after:{
          bankId : ObjectId.createFromHexString(body.bankId.toString()),
          count: body.count,
          difficulty: body.difficulty,
          tags: body.tags,
        }
      }
    })

    await this.quizService.editQuestionBankConfiguration(quizId, body);
  }

  @OpenAPI({
    summary: 'Get all question banks for a quiz',
    description: 'Retrieves all question banks associated with a quiz.',
  })
  @Authorized()
  @Get('/:quizId/bank')
  @HttpCode(200)
  @ResponseSchema(GetAllQuestionBanksResponse, {
    description: 'List of question banks',
    statusCode: 200,
  })
  @ResponseSchema(QuizNotFoundErrorResponse, {
    description: 'Quiz not found',
    statusCode: 404,
  })
  async getAllQuestionBanks(
    @Params() params: QuizIdParam,
    @Ability(getQuizAbility) {ability},
  ): Promise<QuestionBankRef[]> {
    const {quizId} = params;
    const courseInfo = await this.itemService.getCourseAndVersionByItemId(
      quizId,
    );
    // Build the subject context first
    const quizSubject = subject('Quiz', {
      courseId: courseInfo.courseId,
      versionId: courseInfo.versionId,
    });

    if (!ability.can(QuizActions.View, quizSubject)) {
      throw new ForbiddenError('You do not have permission to view this quiz');
    }

    return await this.quizService.getAllQuestionBanks(quizId);
  }

  @OpenAPI({
    summary: 'Get user metrics for a quiz',
    description: 'Retrieves quiz metrics for a specific user.',
  })
  @Authorized()
  @Get('/:quizId/user/:userId')
  @HttpCode(200)
  @ResponseSchema(UserQuizMetricsResponse, {
    description: 'User quiz metrics',
    statusCode: 200,
  })
  @ResponseSchema(QuizNotFoundErrorResponse, {
    description: 'Quiz not found',
    statusCode: 404,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid request parameters',
    statusCode: 400,
  })
  async getUserMetrices(
    @Params() params: GetUserMatricesParams,
    @Ability(getQuizAbility) {ability},
    @QueryParam('cohortId') cohortId?: string,
  ): Promise<UserQuizMetricsResponse> {
    const {quizId, userId} = params;
    const courseInfo = await this.itemService.getCourseAndVersionByItemId(
      quizId,
    );
    // Build the subject context first
    const quizSubject = subject('Quiz', {
      courseId: courseInfo.courseId,
      versionId: courseInfo.versionId,
    });

    if (!ability.can(QuizActions.GetStats, quizSubject)) {
      throw new ForbiddenError(
        'You do not have permission to view quiz statistics',
      );
    }

    return await this.quizService.getUserMetricsForQuiz(userId, quizId, cohortId);
  }

  @OpenAPI({
    summary: 'Get quiz attempt details',
    description: 'Retrieves details of a specific quiz attempt.',
  })
  @Authorized()
  @Get('/:quizId/attempts/:attemptId')
  @HttpCode(200)
  @ResponseSchema(QuizAttemptResponse, {
    description: 'Quiz attempt details',
    statusCode: 200,
  })
  @ResponseSchema(QuizNotFoundErrorResponse, {
    description: 'Quiz or attempt not found',
    statusCode: 404,
  })
  async getQuizAttempt(
    @Params() params: QuizAttemptParam,
    @Ability(getQuizAbility) {ability},
  ): Promise<QuizAttemptResponse> {
    const {quizId, attemptId} = params;
    const courseInfo = await this.itemService.getCourseAndVersionByItemId(
      quizId,
    );
    // Build the subject context first
    const quizSubject = subject('Quiz', {
      courseId: courseInfo.courseId,
      versionId: courseInfo.versionId,
    });

    if (!ability.can(QuizActions.View, quizSubject)) {
      throw new ForbiddenError(
        'You do not have permission to view this quiz attempt',
      );
    }

    return await this.quizService.getAttemptDetails(attemptId, quizId);
  }

  @OpenAPI({
    summary: 'Get quiz submission details',
    description: 'Retrieves details of a specific quiz submission.',
  })
  @Authorized()
  @Get('/:quizId/submissions/:submissionId')
  @HttpCode(200)
  @ResponseSchema(QuizSubmissionResponse, {
    description: 'Quiz submission details',
    statusCode: 200,
  })
  async getQuizSubmission(
    @Params() params: QuizSubmissionParam,
    @Ability(getQuizAbility) {ability},
  ): Promise<QuizSubmissionResponse> {
    const {submissionId, quizId} = params;
    const courseInfo = await this.itemService.getCourseAndVersionByItemId(
      quizId,
    );
    // Build the subject context first
    const quizSubject = subject('Quiz', {
      courseId: courseInfo.courseId,
      versionId: courseInfo.versionId,
    });

    if (!ability.can(QuizActions.View, quizSubject)) {
      throw new ForbiddenError(
        'You do not have permission to view this quiz submission',
      );
    }

    return await this.quizService.getSubmissionDetails(submissionId, quizId);
  }

  @OpenAPI({
    summary: 'Get all submissions for a quiz',
    description: 'Retrieves all submissions for a quiz.',
  })
  @Authorized()
  @Get('/:quizId/submissions')
  @HttpCode(200)
  @ResponseSchema(GetAllSubmissionsResponse, {
    description: 'List of submissions',
    isArray: true,
    statusCode: 200,
  })
  @ResponseSchema(QuizNotFoundErrorResponse, {
    description: 'Quiz not found',
    statusCode: 404,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid request parameters',
    statusCode: 400,
  })
  async getAllSubmissions(
    @Params() params: QuizIdParam,
    @QueryParams() query: GetQuizSubmissionsQuery,
    @Ability(getQuizAbility) {ability},
  ): Promise<PaginatedSubmissions> {
    const {quizId} = params;
    const courseInfo = await this.itemService.getCourseAndVersionByItemId(
      quizId,
    );
    // Build the subject context first
    const quizSubject = subject('Quiz', {
      courseId: courseInfo.courseId,
      versionId: courseInfo.versionId,
    });

    if (!ability.can(QuizActions.View, quizSubject)) {
      throw new ForbiddenError(
        'You do not have permission to view quiz submissions',
      );
    }

    const submissions = await this.quizService.getAllSubmissions(quizId, query);
    return submissions;
  }

  @OpenAPI({
    summary: 'Get quiz details',
    description: 'Retrieves details of a quiz.',
  })
  @Authorized()
  @Get('/:quizId/details')
  @HttpCode(200)
  @ResponseSchema(QuizDetailsResponse, {
    description: 'Quiz details',
    statusCode: 200,
  })
  @ResponseSchema(QuizNotFoundErrorResponse, {
    description: 'Quiz not found',
    statusCode: 404,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid request parameters',
    statusCode: 400,
  })
  async getQuizDetails(
    @Params() params: QuizIdParam,
    @Ability(getQuizAbility) {ability},
  ): Promise<QuizDetailsResponse> {
    const {quizId} = params;
    const courseInfo = await this.itemService.getCourseAndVersionByItemId(
      quizId,
    );
    // Build the subject context first
    const quizSubject = subject('Quiz', {
      courseId: courseInfo.courseId,
      versionId: courseInfo.versionId,
    });

    if (!ability.can(QuizActions.View, quizSubject)) {
      throw new ForbiddenError(
        'You do not have permission to view quiz details',
      );
    }

    return await this.quizService.getQuizDetails(quizId);
  }

  @OpenAPI({
    summary: 'Get quiz analytics',
    description: 'Retrieves analytics data for a quiz.',
  })
  @Authorized()
  @Get('/:quizId/analytics')
  @HttpCode(200)
  @ResponseSchema(QuizAnalyticsResponse, {
    description: 'Quiz analytics',
    statusCode: 200,
  })
  @ResponseSchema(QuizNotFoundErrorResponse, {
    description: 'Quiz not found',
    statusCode: 404,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid request parameters',
    statusCode: 400,
  })
  async getQuizAnalytics(
    @Params() params: QuizIdParam,
    @Ability(getQuizAbility) {ability},
  ): Promise<QuizAnalyticsResponse> {
    const {quizId} = params;
    const courseInfo = await this.itemService.getCourseAndVersionByItemId(
      quizId,
    );
    // Build the subject context first
    const quizSubject = subject('Quiz', {
      courseId: courseInfo.courseId,
      versionId: courseInfo.versionId,
    });

    if (!ability.can(QuizActions.GetStats, quizSubject)) {
      throw new ForbiddenError(
        'You do not have permission to view quiz analytics',
      );
    }

    // return
    const data = await this.quizService.getQuizAnalytics(quizId);
    return data;
  }

  @OpenAPI({
    summary: 'Get quiz performance statistics',
    description:
      'Retrieves performance statistics for each question in a quiz.',
  })
  @Authorized()
  @Get('/:quizId/performance')
  @HttpCode(200)
  @ResponseSchema(QuizPerformanceResponse, {
    isArray: true,
    description: 'Performance stats per question',
    statusCode: 200,
  })
  @ResponseSchema(QuizNotFoundErrorResponse, {
    description: 'Quiz not found',
    statusCode: 404,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid request parameters',
    statusCode: 400,
  })
  async getQuizPerformance(
    @Params() params: QuizIdParam,
    @Ability(getQuizAbility) {ability},
  ): Promise<QuizPerformanceResponse[]> {
    const {quizId} = params;
    const courseInfo = await this.itemService.getCourseAndVersionByItemId(
      quizId,
    );
    // Build the subject context first
    const quizSubject = subject('Quiz', {
      courseId: courseInfo.courseId,
      versionId: courseInfo.versionId,
    });

    if (!ability.can(QuizActions.GetStats, quizSubject)) {
      throw new ForbiddenError(
        'You do not have permission to view quiz performance statistics',
      );
    }

    return await this.quizService.getQuestionPerformanceStats(quizId);
  }

  @OpenAPI({
    summary: 'Get quiz results',
    description: 'Retrieves results for all students who attempted the quiz.',
  })
  @Authorized()
  @Get('/:quizId/results')
  @HttpCode(200)
  @ResponseSchema(QuizResultsResponse, {
    isArray: true,
    description: 'Quiz results',
    statusCode: 200,
  })
  @ResponseSchema(QuizNotFoundErrorResponse, {
    description: 'Quiz not found',
    statusCode: 404,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid request parameters',
    statusCode: 400,
  })
  async getQuizResults(
    @Params() params: QuizIdParam,
    @Ability(getQuizAbility) {ability},
  ): Promise<QuizResultsResponse[]> {
    const {quizId} = params;
    const courseInfo = await this.itemService.getCourseAndVersionByItemId(
      quizId,
    );
    // Build the subject context first
    const quizSubject = subject('Quiz', {
      courseId: courseInfo.courseId,
      versionId: courseInfo.versionId,
    });

    if (!ability.can(QuizActions.GetStats, quizSubject)) {
      throw new ForbiddenError(
        'You do not have permission to view quiz results',
      );
    }

    return await this.quizService.getQuizResults(quizId);
  }
  // TODO: to be implemented
  // @OpenAPI({
  //   summary: 'Get flagged questions for a quiz',
  //   description: 'Retrieves all flagged questions for a quiz.',
  // })
  // @Authorized()
  // @Get('/:quizId/flagged')
  // @HttpCode(200)
  //
  // // @ResponseSchema(FlaggedQuestionResponse, {
  // //   description: 'Flagged questions',
  // //   statusCode: 200,
  // // })
  // @OnUndefined(200)
  // @ResponseSchema(QuizNotFoundErrorResponse, {
  //   description: 'Quiz not found',
  //   statusCode: 404,
  // })
  // @ResponseSchema(BadRequestErrorResponse, {
  //   description: 'Invalid request parameters',
  //   statusCode: 400,
  // })
  // async getFlaggedQues(
  //   @Params() params: QuizIdParam,
  //   @Ability(getQuizAbility) {ability}
  // ): Promise<FlaggedQuestionResponse> {
  //   const {quizId} = params;
  //   const courseInfo = await this.itemService.getCourseAndVersionByItemId(quizId);
  //   // Build the subject context first
  //   const quizSubject = subject('Quiz', { courseId: courseInfo.courseId, versionId: courseInfo.versionId });

  //   if (!ability.can(QuizActions.View, quizSubject)) {
  //     throw new ForbiddenError('You do not have permission to view flagged questions');
  //   }
  //   return await this.quizService.getFlaggedQuestionsForQuiz(quizId);
  // }

  @OpenAPI({
    summary: 'Override submission score',
    description: `Overrides the score for a specific quiz submission.<br/>
    It returns an empty body with a 200 status code.`,
  })
  @Authorized()
  @Post('/:quizId/submission/:submissionId/score/:score')
  @OnUndefined(200)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid submission ID or score',
    statusCode: 400,
  })
  @ResponseSchema(QuizNotFoundErrorResponse, {
    description: 'Submission not found',
    statusCode: 404,
  })
  async updateQuizSubmissionScore(
    @Params() params: UpdateQuizSubmissionParam,
    @Ability(getQuizAbility) {ability},
  ) {
    const {submissionId, score, quizId} = params;
    const courseInfo = await this.itemService.getCourseAndVersionByItemId(
      quizId,
    );
    // Build the subject context first
    const quizSubject = subject('Quiz', {
      courseId: courseInfo.courseId,
      versionId: courseInfo.versionId,
    });

    if (!ability.can(QuizActions.ModifySubmissions, quizSubject)) {
      throw new ForbiddenError(
        'You do not have permission to modify quiz submissions',
      );
    }

    await this.quizService.overrideSubmissionScore(submissionId, quizId, score);
  }

  @OpenAPI({
    summary: 'Regrade a quiz submission',
    description: `Regrades a quiz submission with new grading results.<br/>
    It returns an empty body with a 200 status code.`,
  })
  @Authorized()
  @Post('/:quizId/submission/:submissionId/regrade')
  @OnUndefined(200)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid submission ID or regrade data',
    statusCode: 400,
  })
  @ResponseSchema(QuizNotFoundErrorResponse, {
    description: 'Submission not found',
    statusCode: 404,
  })
  async regradeSubmission(
    @Params() params: QuizSubmissionParam,
    @Body() body: RegradeSubmissionBody,
    @Ability(getQuizAbility) {ability},
  ) {
    const {submissionId, quizId} = params;
    const courseInfo = await this.itemService.getCourseAndVersionByItemId(
      quizId,
    );
    // Build the subject context first
    const quizSubject = subject('Quiz', {
      courseId: courseInfo.courseId,
      versionId: courseInfo.versionId,
    });

    if (!ability.can(QuizActions.ModifySubmissions, quizSubject)) {
      throw new ForbiddenError(
        'You do not have permission to regrade quiz submissions',
      );
    }

    await this.quizService.regradeSubmission(submissionId, quizId, body);
  }

  @OpenAPI({
    summary: 'Add feedback to a question in a submission',
    description: `Adds feedback to a specific question in a quiz submission.<br/>
    It returns an empty body with a 200 status code.`,
  })
  @Authorized()
  @Post('/:quizId/submission/:submissionId/question/:questionId/feedback')
  @OnUndefined(200)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid submission ID or question ID',
    statusCode: 400,
  })
  @ResponseSchema(QuizNotFoundErrorResponse, {
    description: 'Submission or question not found',
    statusCode: 404,
  })
  async addFeedbackToQuestion(
    @Params() params: AddFeedbackParams,
    @Body() body: AddFeedbackBody,
    @Ability(getQuizAbility) {ability},
  ) {
    const {submissionId, questionId, quizId} = params;
    const {feedback} = body;
    const courseInfo = await this.itemService.getCourseAndVersionByItemId(
      quizId,
    );
    // Build the subject context first
    const quizSubject = subject('Quiz', {
      courseId: courseInfo.courseId,
      versionId: courseInfo.versionId,
    });

    if (!ability.can(QuizActions.ModifyBank, quizSubject)) {
      throw new ForbiddenError(
        'You do not have permission to add feedback to quiz questions',
      );
    }

    await this.quizService.addFeedbackToAnswer(
      submissionId,
      quizId,
      questionId,
      feedback,
    );
  }

  @OpenAPI({
    summary: 'Reset available attempts for a user on a quiz',
    description: `Resets the number of available attempts for a user on a specific quiz.<br/>
    It returns an empty body with a 200 status code.`,
  })
  @Authorized()
  @Post('/:quizId/user/:userId/reset-attempts')
  @OnUndefined(200)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid quiz ID or user ID',
    statusCode: 400,
  })
  @ResponseSchema(QuizNotFoundErrorResponse, {
    description: 'Quiz not found',
    statusCode: 404,
  })
  async resetAvailableAttempts(
    @Params() params: GetUserMatricesParams,
    @Ability(getQuizAbility) {ability},
  ): Promise<void> {
    const {quizId, userId} = params;
    const courseInfo = await this.itemService.getCourseAndVersionByItemId(
      quizId,
    );
    // Build the subject context first
    const quizSubject = subject('Quiz', {
      courseId: courseInfo.courseId,
      versionId: courseInfo.versionId,
    });

    if (!ability.can(QuizActions.ModifySubmissions, quizSubject)) {
      throw new ForbiddenError(
        'You do not have permission to reset quiz attempts',
      );
    }
    await this.quizService.resetAvailableAttempts(quizId, userId);
  }

  @OpenAPI({
    summary: 'Update missing submission result IDs for a quiz',
    description: `Updates missing submission result IDs for a specific quiz.<br/>
    It returns an empty body with a 200 status code.`,
  })
  @Authorized()
  @Patch('/update-missing-submission-result-ids')
  @OnUndefined(200)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid quiz ID',
    statusCode: 400,
  })
  @ResponseSchema(QuizNotFoundErrorResponse, {
    description: 'Quiz not found',
    statusCode: 404,
  })
  async updateMissingSubmissionResultIds(
    @Ability(getQuizAbility) {ability},
  ): Promise<void> {
    await this.quizService.updateMissingSubmissionResultIds();
  }
}

export {QuizController};
