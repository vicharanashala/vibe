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
} from '#quizzes/classes/validators/QuizValidator.js';
import {QuestionBankService} from '#quizzes/services/QuestionBankService.js';
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
  Authorized,
  BadRequestError,
  Res,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {QUIZZES_TYPES} from '#quizzes/types.js';
import {ISubmission} from '#quizzes/interfaces/index.js';

@OpenAPI({
  tags: ['Quiz'],
})
@injectable()
@JsonController('/quizzes/quiz')
class QuizController {
  constructor(
    @inject(QUIZZES_TYPES.QuizService)
    private readonly quizService: QuizService,
    @inject(QUIZZES_TYPES.QuestionBankService)
    private readonly questionBankService: QuestionBankService,
  ) {}

  @OpenAPI({
    summary: 'Add a question bank to a quiz',
    description: 'Associates a question bank with a quiz.',
  })
  @Authorized(['admin', 'instructor'])
  @Post('/:quizId/bank')
  @OnUndefined(200)
  @ResponseSchema(QuizNotFoundErrorResponse, {
    description: 'Quiz not found',
    statusCode: 404,
  })
  @ResponseSchema(BadRequestError, {
    description: 'Invalid request body or parameters',
    statusCode: 400,
  })
  async addQuestionBank(
    @Params() params: QuizIdParam,
    @Body() body: AddQuestionBankBody,
  ) {
    const {quizId} = params;
    await this.quizService.addQuestionBank(quizId, body);
  }

  @OpenAPI({
    summary: 'Remove a question bank from a quiz',
    description: 'Removes the association of a question bank from a quiz.',
  })
  @Authorized(['admin', 'instructor'])
  @Delete('/:quizId/bank/:questionBankId')
  @OnUndefined(200)
  @ResponseSchema(QuizNotFoundErrorResponse, {
    description: 'Quiz or question bank not found',
    statusCode: 404,
  })
  async removeQuestionBank(@Params() params: RemoveQuestionBankParams) {
    const {quizId, questionBankId} = params;
    await this.quizService.removeQuestionBank(quizId, questionBankId);
  }

  @OpenAPI({
    summary: 'Edit question bank configuration for a quiz',
    description: 'Updates the configuration of a question bank within a quiz.',
  })
  @Authorized(['admin', 'instructor'])
  @Patch('/:quizId/bank')
  @OnUndefined(200)
  @ResponseSchema(QuizNotFoundErrorResponse, {
    description: 'Quiz not found',
    statusCode: 404,
  })
  @ResponseSchema(BadRequestError, {
    description: 'Invalid request body or parameters',
    statusCode: 400,
  })
  async editQuestionBank(
    @Params() params: QuizIdParam,
    @Body() body: EditQuestionBankBody,
  ) {
    const {quizId} = params;
    await this.quizService.editQuestionBankConfiguration(quizId, body);
  }

  @OpenAPI({
    summary: 'Get all question banks for a quiz',
    description: 'Retrieves all question banks associated with a quiz.',
  })
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
  ): Promise<QuestionBankRef[]> {
    const {quizId} = params;
    return await this.quizService.getAllQuestionBanks(quizId);
  }

  @OpenAPI({
    summary: 'Get user metrics for a quiz',
    description: 'Retrieves quiz metrics for a specific user.',
  })
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
  @ResponseSchema(BadRequestError, {
    description: 'Invalid request parameters',
    statusCode: 400,
  })
  async getUserMetrices(
    @Params() params: GetUserMatricesParams,
  ): Promise<UserQuizMetricsResponse> {
    const {quizId, userId} = params;
    return await this.quizService.getUserMetricsForQuiz(userId, quizId);
  }

  @OpenAPI({
    summary: 'Get quiz attempt details',
    description: 'Retrieves details of a specific quiz attempt.',
  })
  @Get('/attempts/:attemptId')
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
  ): Promise<QuizAttemptResponse> {
    const {attemptId} = params;
    return await this.quizService.getAttemptDetails(attemptId);
  }

  @OpenAPI({
    summary: 'Get quiz submission details',
    description: 'Retrieves details of a specific quiz submission.',
  })
  @Get('/submissions/:submissionId')
  @HttpCode(200)
  @ResponseSchema(QuizSubmissionResponse, {
    description: 'Quiz submission details',
    statusCode: 200,
  })
  async getQuizSubmission(
    @Params() params: QuizSubmissionParam,
  ): Promise<QuizSubmissionResponse> {
    const {submissionId} = params;
    return await this.quizService.getSubmissionDetails(submissionId);
  }

  @OpenAPI({
    summary: 'Get all submissions for a quiz',
    description: 'Retrieves all submissions for a quiz.',
  })
  @Authorized(['admin', 'instructor'])
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
  @ResponseSchema(BadRequestError, {
    description: 'Invalid request parameters',
    statusCode: 400,
  })
  async getAllSubmissions(
    @Params() params: QuizIdParam,
  ): Promise<ISubmission[]> {
    const {quizId} = params;
    return await this.quizService.getAllSubmissions(quizId);
  }

  @OpenAPI({
    summary: 'Get quiz details',
    description: 'Retrieves details of a quiz.',
  })
  @Authorized(['admin', 'instructor'])
  @Get('/:quizId/details')
  @HttpCode(200)
  @ResponseSchema(QuizDetailsResponse, {
    description: 'Quiz details',
    statusCode: 200,
  })
  async getQuizDetails(
    @Params() params: QuizIdParam,
  ): Promise<QuizDetailsResponse> {
    const {quizId} = params;
    return await this.quizService.getQuizDetails(quizId);
  }

  @OpenAPI({
    summary: 'Get quiz analytics',
    description: 'Retrieves analytics data for a quiz.',
  })
  @Authorized(['admin', 'instructor'])
  @Get('/:quizId/analytics')
  @HttpCode(200)
  @ResponseSchema(QuizAnalyticsResponse, {
    description: 'Quiz analytics',
    statusCode: 200,
  })
  async getQuizAnalytics(
    @Params() params: QuizIdParam,
  ): Promise<QuizAnalyticsResponse> {
    const {quizId} = params;
    return await this.quizService.getQuizAnalytics(quizId);
  }

  @OpenAPI({
    summary: 'Get quiz performance statistics',
    description: 'Retrieves performance statistics for each question in a quiz.',
  })
  @Authorized(['admin', 'instructor'])
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
  @ResponseSchema(BadRequestError, {
    description: 'Invalid request parameters',
    statusCode: 400,
  })
  async getQuizPerformance(
    @Params() params: QuizIdParam,
  ): Promise<QuizPerformanceResponse[]> {
    const {quizId} = params;
    return await this.quizService.getQuestionPerformanceStats(quizId);
  }

  @OpenAPI({
    summary: 'Get quiz results',
    description: 'Retrieves results for all students who attempted the quiz.',
  })
  @Authorized(['admin', 'instructor'])
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
  @ResponseSchema(BadRequestError, {
    description: 'Invalid request parameters',
    statusCode: 400,
  })
  async getQuizResults(
    @Params() params: QuizIdParam,
  ): Promise<QuizResultsResponse[]> {
    const {quizId} = params;
    return await this.quizService.getQuizResults(quizId);
  }

  @OpenAPI({
    summary: 'Get flagged questions for a quiz',
    description: 'Retrieves all flagged questions for a quiz.',
  })
  @Authorized(['admin', 'instructor'])
  @Get('/:quizId/flagged')
  @HttpCode(200)
  @ResponseSchema(FlaggedQuestionResponse, {
    description: 'Flagged questions',
    statusCode: 200,
  })
  @ResponseSchema(QuizNotFoundErrorResponse, {
    description: 'Quiz not found',
    statusCode: 404,
  })
  @ResponseSchema(BadRequestError, {
    description: 'Invalid request parameters',
    statusCode: 400,
  })
  async getFlaggedQues(
    @Params() params: QuizIdParam,
  ): Promise<FlaggedQuestionResponse> {
    const {quizId} = params;
    return await this.quizService.getFlaggedQuestionsForQuiz(quizId);
  }

  @OpenAPI({
    summary: 'Override submission score',
    description: 'Overrides the score for a specific quiz submission.',
  })
  @Authorized(['admin', 'instructor'])
  @Post('/submission/:submissionId/score/:score')
  @OnUndefined(200)
  @ResponseSchema(BadRequestError, {
    description: 'Invalid submission ID or score',
    statusCode: 400,
  })
  @ResponseSchema(QuizNotFoundErrorResponse, {
    description: 'Submission not found',
    statusCode: 404,
  })
  async updateQuizSubmissionScore(@Params() params: UpdateQuizSubmissionParam) {
    const {submissionId, score} = params;
    await this.quizService.overrideSubmissionScore(submissionId, score);
  }

  @OpenAPI({
    summary: 'Regrade a quiz submission',
    description: 'Regrades a quiz submission with new grading results.',
  })
  @Authorized(['admin', 'instructor'])
  @Post('/submission/:submissionId/regrade')
  @OnUndefined(200)
  @ResponseSchema(BadRequestError, {
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
  ) {
    const {submissionId} = params;
    await this.quizService.regradeSubmission(submissionId, body);
  }

  @OpenAPI({
    summary: 'Add feedback to a question in a submission',
    description: 'Adds feedback to a specific question in a quiz submission.',
  })
  @Authorized(['admin', 'instructor'])
  @Post('/submission/:submissionId/question/:questionId/feedback')
  @OnUndefined(200)
  @ResponseSchema(BadRequestError, {
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
  ) {
    const {submissionId, questionId} = params;
    const {feedback} = body;
    await this.quizService.addFeedbackToAnswer(
      submissionId,
      questionId,
      feedback,
    );
  }
}

export {QuizController};
