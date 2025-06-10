import {injectable, inject} from 'inversify';
import {
  Body,
  Get,
  JsonController,
  Params,
  Patch,
  Post,
  HttpCode,
  Delete,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {QuizService} from '../services/QuizService';
import {
  QuizIdParam,
  RemoveQuestionBankParams,
  UserQuizMetricsResponse,
  QuizAttemptResponse,
  QuizSubmissionResponse,
  QuizDetailsResponse,
  QuizAnalyticsResponse,
  QuizPerformanceResponse,
  QuizResultsResponse,
  FlaggedQuestionResponse,
  GetUserMatricesParams,
  QuizAttemptParam,
  QuizSubmissionParam,
  UpdateQuizSubmissionParam,
  AddFeedbackParams,
  AddQuestionBankBody,
  EditQuestionBankBody,
  RegradeSubmissionBody,
  AddFeedbackBody,
} from '../classes/validators/QuizValidator';
import TYPES from '../types';
import {QuestionBankService} from '../services/QuestionBankService';
import {QuestionBankRef} from '../classes/transformers/QuestionBank';
import {IGradingResult} from '../interfaces/grading';

@OpenAPI({
  tags: ['Quizzes'],
})
@injectable()
@JsonController('/quiz')
class QuizController {
  constructor(
    @inject(TYPES.QuizService)
    private readonly quizService: QuizService,
    @inject(TYPES.QuestionBankService)
    private readonly questionBankService: QuestionBankService,
  ) {}

  @Post('/:quizId/bank')
  @HttpCode(201)
  @OpenAPI({
    summary: 'Add question bank to quiz',
    description: 'Associate a question bank with a specific quiz',
  })
  @ResponseSchema(QuestionBankRef, {
    description: 'Question bank added successfully',
  })
  async addQuestionBank(
    @Params() params: QuizIdParam,
    @Body() body: AddQuestionBankBody,
  ) {
    const {quizId} = params;
    await this.quizService.addQuestionBank(quizId, body);
  }

  @Delete('/:quizId/bank/:questionBankId')
  @HttpCode(204)
  @OpenAPI({
    summary: 'Remove question bank from quiz',
    description: 'Remove a question bank association from a specific quiz',
  })
  async removeQuestionBank(@Params() params: RemoveQuestionBankParams) {
    const {quizId, questionBankId} = params;
    await this.quizService.removeQuestionBank(quizId, questionBankId);
  }

  @Patch('/:quizId/bank')
  @HttpCode(200)
  @OpenAPI({
    summary: 'Edit question bank configuration',
    description:
      'Update the configuration of a question bank associated with a quiz',
  })
  async editQuestionBank(
    @Params() params: QuizIdParam,
    @Body() body: EditQuestionBankBody,
  ) {
    const {quizId} = params;
    await this.quizService.editQuestionBankConfiguration(quizId, body);
  }

  @Get('/:quizId/bank')
  @OpenAPI({
    summary: 'Get all question banks for quiz',
    description: 'Retrieve all question banks associated with a quiz',
  })
  @ResponseSchema(QuestionBankRef, {
    description: 'Question banks retrieved successfully',
    isArray: true,
  })
  async getAllQuestionBanks(
    @Params() params: QuizIdParam,
  ): Promise<QuestionBankRef[]> {
    const {quizId} = params;
    return await this.quizService.getAllQuestionBanks(quizId);
  }

  @Get('/:quizId/user/:userId')
  @OpenAPI({
    summary: 'Get user quiz metrics',
    description:
      'Retrieve metrics and performance data for a user on a specific quiz',
  })
  @ResponseSchema(UserQuizMetricsResponse, {
    description: 'User quiz metrics retrieved successfully',
  })
  async getUserMetrices(
    @Params() params: GetUserMatricesParams,
  ): Promise<UserQuizMetricsResponse> {
    const {quizId, userId} = params;
    return await this.quizService.getUserMetricsForQuiz(userId, quizId);
  }

  @Get('/attempts/:attemptId')
  @OpenAPI({
    summary: 'Get quiz attempt details',
    description: 'Retrieve detailed information about a specific quiz attempt',
  })
  @ResponseSchema(QuizAttemptResponse, {
    description: 'Quiz attempt details retrieved successfully',
  })
  async getQuizAttempt(
    @Params() params: QuizAttemptParam,
  ): Promise<QuizAttemptResponse> {
    const {attemptId} = params;
    return await this.quizService.getAttemptDetails(attemptId);
  }

  @Get('/submissions/:submissionId')
  @OpenAPI({
    summary: 'Get quiz submission details',
    description:
      'Retrieve detailed information about a specific quiz submission',
  })
  @ResponseSchema(QuizSubmissionResponse, {
    description: 'Quiz submission details retrieved successfully',
  })
  async getQuizSubmission(
    @Params() params: QuizSubmissionParam,
  ): Promise<QuizSubmissionResponse> {
    const {submissionId} = params;
    return await this.quizService.getSubmissionDetails(submissionId);
  }

  @Get('/:quizId/details')
  @OpenAPI({
    summary: 'Get quiz details',
    description: 'Retrieve detailed configuration and information about a quiz',
  })
  @ResponseSchema(QuizDetailsResponse, {
    description: 'Quiz details retrieved successfully',
  })
  async getQuizDetails(
    @Params() params: QuizIdParam,
  ): Promise<QuizDetailsResponse> {
    const {quizId} = params;
    return await this.quizService.getQuizDetails(quizId);
  }

  @Get('/:quizId/analytics')
  @OpenAPI({
    summary: 'Get quiz analytics',
    description: 'Retrieve analytics data for a quiz',
  })
  @ResponseSchema(QuizAnalyticsResponse, {
    description: 'Quiz analytics retrieved successfully',
  })
  async getQuizAnalytics(
    @Params() params: QuizIdParam,
  ): Promise<QuizAnalyticsResponse> {
    const {quizId} = params;
    return await this.quizService.getQuizAnalytics(quizId);
  }

  @Get('/:quizId/performance')
  @OpenAPI({
    summary: 'Get quiz performance statistics',
    description: 'Retrieve performance statistics for the quiz',
  })
  @ResponseSchema(QuizPerformanceResponse, {
    description: 'Quiz performance statistics retrieved successfully',
    isArray: true,
  })
  async getQuizPerformance(
    @Params() params: QuizIdParam,
  ): Promise<QuizPerformanceResponse[]> {
    const {quizId} = params;
    return await this.quizService.getQuestionPerformanceStats(quizId);
  }

  @Get('/:quizId/results')
  @OpenAPI({
    summary: 'Get quiz results',
    description: 'Retrieve results for the quiz',
  })
  @ResponseSchema(QuizResultsResponse, {
    description: 'Quiz results retrieved successfully',
    isArray: true,
  })
  async getQuizResults(
    @Params() params: QuizIdParam,
  ): Promise<QuizResultsResponse[]> {
    const {quizId} = params;
    return await this.quizService.getQuizResults(quizId);
  }

  @Get('/:quizId/flagged')
  @OpenAPI({
    summary: 'Get flagged questions',
    description: 'Retrieve questions that have been flagged in the quiz',
  })
  @ResponseSchema(FlaggedQuestionResponse, {
    description: 'Flagged questions retrieved successfully',
  })
  async getFlaggedQues(
    @Params() params: QuizIdParam,
  ): Promise<FlaggedQuestionResponse> {
    const {quizId} = params;
    return await this.quizService.getFlaggedQuestionsForQuiz(quizId);
  }

  @Post('/submission/:submissionId/score/:score')
  @HttpCode(201)
  @OpenAPI({
    summary: 'Update quiz submission score',
    description: 'update the score for a specific quiz submission',
  })
  async updateQuizSubmissionScore(@Params() params: UpdateQuizSubmissionParam) {
    const {submissionId, score} = params;
    await this.quizService.overrideSubmissionScore(submissionId, score);
  }

  @Post('/submission/:submissionId/regrade')
  @HttpCode(201)
  @OpenAPI({
    summary: 'Regrade quiz submission',
    description: 'Regrade a quiz submission',
  })
  async regradeSubmission(
    @Params() params: QuizSubmissionParam,
    @Body() body: RegradeSubmissionBody,
  ) {
    const {submissionId} = params;
    await this.quizService.regradeSubmission(submissionId, body);
  }

  @Post('/submission/:submissionId/question/:questionId/feedback')
  @HttpCode(201)
  @OpenAPI({
    summary: 'Add feedback to question answer',
    description:
      'Add instructor feedback to a specific question answer in a submission',
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
