import {QuestionBankRef} from '#quizzes/classes/transformers/QuestionBank.js';
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
} from 'routing-controllers';
import {QUIZZES_TYPES} from '#quizzes/types.js';
@injectable()
@JsonController('/quiz')
class QuizController {
  constructor(
    @inject(QUIZZES_TYPES.QuizService)
    private readonly quizService: QuizService,
    @inject(QUIZZES_TYPES.QuestionBankService)
    private readonly questionBankService: QuestionBankService,
  ) {}

  @Post('/:quizId/bank')
  @HttpCode(201)
  async addQuestionBank(
    @Params() params: QuizIdParam,
    @Body() body: AddQuestionBankBody,
  ) {
    const {quizId} = params;
    await this.quizService.addQuestionBank(quizId, body);
  }

  @Delete('/:quizId/bank/:questionBankId')
  @HttpCode(204)
  async removeQuestionBank(@Params() params: RemoveQuestionBankParams) {
    const {quizId, questionBankId} = params;
    await this.quizService.removeQuestionBank(quizId, questionBankId);
  }

  @Post('/:quizId/bank')
  @HttpCode(200)
  async editQuestionBank(
    @Params() params: QuizIdParam,
    @Body() body: EditQuestionBankBody,
  ) {
    const {quizId} = params;
    await this.quizService.editQuestionBankConfiguration(quizId, body);
  }

  @Get('/:quizId/bank')
  async getAllQuestionBanks(
    @Params() params: QuizIdParam,
  ): Promise<QuestionBankRef[]> {
    const {quizId} = params;
    return await this.quizService.getAllQuestionBanks(quizId);
  }

  @Get('/:quizId/user/:userId')
  async getUserMetrices(
    @Params() params: GetUserMatricesParams,
  ): Promise<UserQuizMetricsResponse> {
    const {quizId, userId} = params;
    return await this.quizService.getUserMetricsForQuiz(userId, quizId);
  }

  @Get('/attempts/:attemptId')
  async getQuizAttempt(
    @Params() params: QuizAttemptParam,
  ): Promise<QuizAttemptResponse> {
    const {attemptId} = params;
    return await this.quizService.getAttemptDetails(attemptId);
  }

  @Get('/submissions/:submissionId')
  async getQuizSubmission(
    @Params() params: QuizSubmissionParam,
  ): Promise<QuizSubmissionResponse> {
    const {submissionId} = params;
    return await this.quizService.getSubmissionDetails(submissionId);
  }

  @Get('/:quizId/details')
  async getQuizDetails(
    @Params() params: QuizIdParam,
  ): Promise<QuizDetailsResponse> {
    const {quizId} = params;
    return await this.quizService.getQuizDetails(quizId);
  }

  @Get('/:quizId/analytics')
  async getQuizAnalytics(
    @Params() params: QuizIdParam,
  ): Promise<QuizAnalyticsResponse> {
    const {quizId} = params;
    return await this.quizService.getQuizAnalytics(quizId);
  }

  @Get('/:quizId/performance')
  async getQuizPerformance(
    @Params() params: QuizIdParam,
  ): Promise<QuizPerformanceResponse[]> {
    const {quizId} = params;
    return await this.quizService.getQuestionPerformanceStats(quizId);
  }

  @Get('/:quizId/results')
  async getQuizResults(
    @Params() params: QuizIdParam,
  ): Promise<QuizResultsResponse[]> {
    const {quizId} = params;
    return await this.quizService.getQuizResults(quizId);
  }

  @Get('/:quizId/flagged')
  async getFlaggedQues(
    @Params() params: QuizIdParam,
  ): Promise<FlaggedQuestionResponse> {
    const {quizId} = params;
    return await this.quizService.getFlaggedQuestionsForQuiz(quizId);
  }

  @Post('/submission/:submissionId/score/:score')
  @HttpCode(201)
  async updateQuizSubmissionScore(@Params() params: UpdateQuizSubmissionParam) {
    const {submissionId, score} = params;
    await this.quizService.overrideSubmissionScore(submissionId, score);
  }

  @Post('/submission/:submissionId/regrade')
  @HttpCode(201)
  async regradeSubmission(
    @Params() params: QuizSubmissionParam,
    @Body() body: RegradeSubmissionBody,
  ) {
    const {submissionId} = params;
    await this.quizService.regradeSubmission(submissionId, body);
  }

  @Post('/submission/:submissionId/question/:questionId/feedback')
  @HttpCode(201)
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
