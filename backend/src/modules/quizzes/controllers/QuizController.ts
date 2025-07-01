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
import { Ability } from '#root/shared/functions/AbilityDecorator.js';
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
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {QUIZZES_TYPES} from '#quizzes/types.js';
import {ISubmission} from '#quizzes/interfaces/index.js';
import { QuizActions, getQuizAbility } from '../abilities/quizAbilities.js';
import { subject } from '@casl/ability';

@OpenAPI({
  tags: ['Quiz'],
})
@injectable()
@JsonController('/quizzes/quiz')
class QuizController {
  constructor(
    @inject(QUIZZES_TYPES.QuizService)
    private readonly quizService: QuizService,
  ) {}

  @OpenAPI({
    summary: 'Add a question bank to a quiz',
    description: 'Associates a question bank with a quiz.',
  })
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
    @Ability(getQuizAbility) {ability}
  ) {
    const {quizId} = params;
    
    // Build the subject context first
    const quizSubject = subject('Quiz', { quizId });
    
    if (!ability.can(QuizActions.ModifyBank, quizSubject)) {
      throw new ForbiddenError('You do not have permission to modify quiz question banks');
    }
    
    await this.quizService.addQuestionBank(quizId, body);
  }

  @OpenAPI({
    summary: 'Remove a question bank from a quiz',
    description: 'Removes the association of a question bank from a quiz.',
  })
  @Delete('/:quizId/bank/:questionBankId')
  @OnUndefined(200)
  @ResponseSchema(QuizNotFoundErrorResponse, {
    description: 'Quiz or question bank not found',
    statusCode: 404,
  })
  async removeQuestionBank(
    @Params() params: RemoveQuestionBankParams,
    @Ability(getQuizAbility) {ability}
  ) {
    const {quizId, questionBankId} = params;
    
    // Build the subject context first
    const quizSubject = subject('Quiz', { quizId, questionBankId });
    
    if (!ability.can(QuizActions.ModifyBank, quizSubject)) {
      throw new ForbiddenError('You do not have permission to modify quiz question banks');
    }
    
    await this.quizService.removeQuestionBank(quizId, questionBankId);
  }

  @OpenAPI({
    summary: 'Edit question bank configuration for a quiz',
    description: 'Updates the configuration of a question bank within a quiz.',
  })
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
    @Ability(getQuizAbility) {ability}
  ) {
    const {quizId} = params;
    
    // Build the subject context first
    const quizSubject = subject('Quiz', { quizId });
    
    if (!ability.can(QuizActions.ModifyBank, quizSubject)) {
      throw new ForbiddenError('You do not have permission to modify quiz question banks');
    }
    
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
    @Ability(getQuizAbility) {ability}
  ): Promise<QuestionBankRef[]> {
    const {quizId} = params;
    
    // Build the subject context first
    const quizSubject = subject('Quiz', { quizId });
    
    if (!ability.can(QuizActions.View, quizSubject)) {
      throw new ForbiddenError('You do not have permission to view this quiz');
    }
    
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
    @Ability(getQuizAbility) {ability}
  ): Promise<UserQuizMetricsResponse> {
    const {quizId, userId} = params;
    
    // Build the subject context first
    const quizSubject = subject('Quiz', { quizId, userId });
    
    if (!ability.can(QuizActions.GetStats, quizSubject)) {
      throw new ForbiddenError('You do not have permission to view quiz statistics');
    }
    
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
    @Ability(getQuizAbility) {ability}
  ): Promise<QuizAttemptResponse> {
    const {attemptId} = params;
    
    // Build the subject context first
    const quizSubject = subject('Quiz', { attemptId });
    
    if (!ability.can(QuizActions.View, quizSubject)) {
      throw new ForbiddenError('You do not have permission to view this quiz attempt');
    }
    
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
    @Ability(getQuizAbility) {ability}
  ): Promise<QuizSubmissionResponse> {
    const {submissionId} = params;
    
    // Build the subject context first
    const quizSubject = subject('Quiz', { submissionId });
    
    if (!ability.can(QuizActions.View, quizSubject)) {
      throw new ForbiddenError('You do not have permission to view this quiz submission');
    }
    
    return await this.quizService.getSubmissionDetails(submissionId);
  }

  @OpenAPI({
    summary: 'Get all submissions for a quiz',
    description: 'Retrieves all submissions for a quiz.',
  })
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
    @Ability(getQuizAbility) {ability}
  ): Promise<ISubmission[]> {
    const {quizId} = params;
    
    // Build the subject context first
    const quizSubject = subject('Quiz', { quizId });
    
    if (!ability.can(QuizActions.View, quizSubject)) {
      throw new ForbiddenError('You do not have permission to view quiz submissions');
    }
    
    return await this.quizService.getAllSubmissions(quizId);
  }

  @OpenAPI({
    summary: 'Get quiz details',
    description: 'Retrieves details of a quiz.',
  })
  @Get('/:quizId/details')
  @HttpCode(200)
  @ResponseSchema(QuizDetailsResponse, {
    description: 'Quiz details',
    statusCode: 200,
  })
  async getQuizDetails(
    @Params() params: QuizIdParam,
    @Ability(getQuizAbility) {ability}
  ): Promise<QuizDetailsResponse> {
    const {quizId} = params;
    
    // Build the subject context first
    const quizSubject = subject('Quiz', { quizId });
    
    if (!ability.can(QuizActions.View, quizSubject)) {
      throw new ForbiddenError('You do not have permission to view quiz details');
    }
    
    return await this.quizService.getQuizDetails(quizId);
  }

  @OpenAPI({
    summary: 'Get quiz analytics',
    description: 'Retrieves analytics data for a quiz.',
  })
  @Get('/:quizId/analytics')
  @HttpCode(200)
  @ResponseSchema(QuizAnalyticsResponse, {
    description: 'Quiz analytics',
    statusCode: 200,
  })
  async getQuizAnalytics(
    @Params() params: QuizIdParam,
    @Ability(getQuizAbility) {ability}
  ): Promise<QuizAnalyticsResponse> {
    const {quizId} = params;
    
    // Build the subject context first
    const quizSubject = subject('Quiz', { quizId });
    
    if (!ability.can(QuizActions.GetStats, quizSubject)) {
      throw new ForbiddenError('You do not have permission to view quiz analytics');
    }
    
    return await this.quizService.getQuizAnalytics(quizId);
  }

  @OpenAPI({
    summary: 'Get quiz performance statistics',
    description: 'Retrieves performance statistics for each question in a quiz.',
  })
  
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
    @Ability(getQuizAbility) {ability}
  ): Promise<QuizPerformanceResponse[]> {
    const {quizId} = params;
    
    // Build the subject context first
    const quizSubject = subject('Quiz', { quizId });
    
    if (!ability.can(QuizActions.GetStats, quizSubject)) {
      throw new ForbiddenError('You do not have permission to view quiz performance statistics');
    }
    
    return await this.quizService.getQuestionPerformanceStats(quizId);
  }

  @OpenAPI({
    summary: 'Get quiz results',
    description: 'Retrieves results for all students who attempted the quiz.',
  })
  
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
    @Ability(getQuizAbility) {ability}
  ): Promise<QuizResultsResponse[]> {
    const {quizId} = params;
    
    // Build the subject context first
    const quizSubject = subject('Quiz', { quizId });
    
    if (!ability.can(QuizActions.GetStats, quizSubject)) {
      throw new ForbiddenError('You do not have permission to view quiz results');
    }
    
    return await this.quizService.getQuizResults(quizId);
  }

  @OpenAPI({
    summary: 'Get flagged questions for a quiz',
    description: 'Retrieves all flagged questions for a quiz.',
  })
  
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
    @Ability(getQuizAbility) {ability}
  ): Promise<FlaggedQuestionResponse> {
    const {quizId} = params;
    
    // Build the subject context first
    const quizSubject = subject('Quiz', { quizId });
    
    if (!ability.can(QuizActions.View, quizSubject)) {
      throw new ForbiddenError('You do not have permission to view flagged questions');
    }
    return await this.quizService.getFlaggedQuestionsForQuiz(quizId);
  }

  @OpenAPI({
    summary: 'Override submission score',
    description: 'Overrides the score for a specific quiz submission.',
  })
  
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
  async updateQuizSubmissionScore(
    @Params() params: UpdateQuizSubmissionParam,
    @Ability(getQuizAbility) {ability}
  ) {
    const {submissionId, score} = params;
    
    // Build the subject context first
    const quizSubject = subject('Quiz', { submissionId });
    
    if (!ability.can(QuizActions.ModifySubmissions, quizSubject)) {
      throw new ForbiddenError('You do not have permission to modify quiz submissions');
    }
    
    await this.quizService.overrideSubmissionScore(submissionId, score);
  }

  @OpenAPI({
    summary: 'Regrade a quiz submission',
    description: 'Regrades a quiz submission with new grading results.',
  })
  
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
    @Ability(getQuizAbility) {ability}
  ) {
    const {submissionId} = params;
    
    // Build the subject context first
    const quizSubject = subject('Quiz', { submissionId });
    
    if (!ability.can(QuizActions.ModifySubmissions, quizSubject)) {
      throw new ForbiddenError('You do not have permission to regrade quiz submissions');
    }
    
    await this.quizService.regradeSubmission(submissionId, body);
  }

  @OpenAPI({
    summary: 'Add feedback to a question in a submission',
    description: 'Adds feedback to a specific question in a quiz submission.',
  })
  
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
    @Ability(getQuizAbility) {ability}
  ) {
    const {submissionId, questionId} = params;
    const {feedback} = body;
    
    // Build the subject context first
    const quizSubject = subject('Quiz', { submissionId, questionId });
    
    if (!ability.can(QuizActions.ModifyBank, quizSubject)) {
      throw new ForbiddenError('You do not have permission to add feedback to quiz questions');
    }
    
    await this.quizService.addFeedbackToAnswer(
      submissionId,
      questionId,
      feedback,
    );
  }

  @OpenAPI({
    summary: 'Reset available attempts for a user on a quiz',
    description: 'Resets the number of available attempts for a user on a specific quiz.',
  })
  
  @Post('/:quizId/user/:userId/reset-attempts')
  @OnUndefined(200)
  @ResponseSchema(BadRequestError, {
    description: 'Invalid quiz ID or user ID',
    statusCode: 400,
  })
  @ResponseSchema(QuizNotFoundErrorResponse, {
    description: 'Quiz not found',
    statusCode: 404,
  })
  async resetAvailableAttempts(
    @Params() params: GetUserMatricesParams,
    @Ability(getQuizAbility) {ability}
  ): Promise<void> {
    const {quizId, userId} = params;
    
    // Build the subject context first
    const quizSubject = subject('Quiz', { quizId, userId });
    
    if (!ability.can(QuizActions.ModifySubmissions, quizSubject)) {
      throw new ForbiddenError('You do not have permission to reset quiz attempts');
    }
    await this.quizService.resetAvailableAttempts(quizId, userId);
  }
}

export {QuizController};
