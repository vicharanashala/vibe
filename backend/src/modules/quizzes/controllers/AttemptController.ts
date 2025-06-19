import {
  Body,
  Get,
  HttpCode,
  JsonController,
  OnUndefined,
  Params,
  Post,
  Req,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {AttemptService} from '#quizzes/services/AttemptService.js';
import {injectable, inject} from 'inversify';
import {
  CreateAttemptParams,
  CreateAttemptResponse,
  SaveAttemptParams,
  QuestionAnswersBody,
  SubmitAttemptParams,
  SubmitAttemptResponse,
  GetAttemptResponse,
  AttemptNotFoundErrorResponse,
} from '#quizzes/classes/validators/QuizValidator.js';
import {QUIZZES_TYPES} from '#quizzes/types.js';
import {IAttempt} from '#quizzes/interfaces/index.js';
import {AUTH_TYPES} from '#auth/types.js';
import {FirebaseAuthService} from '#auth/services/FirebaseAuthService.js';
import { BadRequestErrorResponse } from '#root/shared/index.js';

@OpenAPI({
  tags: ['Quiz Attempts'],
})
@injectable()
@JsonController('/quizzes')
class AttemptController {
  constructor(
    @inject(QUIZZES_TYPES.AttemptService)
    private readonly attemptService: AttemptService,
    @inject(AUTH_TYPES.AuthService)
    private readonly authService: FirebaseAuthService,
  ) {}

  @OpenAPI({
    summary: 'Start a new quiz attempt',
    description: 'Creates a new attempt for the specified quiz for the current user.',
  })
  @Post('/:quizId/attempt')
  @HttpCode(200)
  @ResponseSchema(CreateAttemptResponse, {
    description: 'Attempt created successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, { description: 'Bad Request', statusCode: 400 })
  @ResponseSchema(AttemptNotFoundErrorResponse, { description: 'Quiz not found', statusCode: 404 })
  async attempt(
    @Req() req: any,
    @Params() params: CreateAttemptParams,
  ): Promise<CreateAttemptResponse> {
    const {quizId} = params;
    const userId = await this.authService.getUserIdFromReq(req);
    const attempt = await this.attemptService.attempt(userId, quizId);
    return attempt as CreateAttemptResponse;
  }

  @OpenAPI({
    summary: 'Save answers for an ongoing attempt',
    description: 'Saves the current answers for a quiz attempt without submitting.',
  })
  @OnUndefined(200)
  @ResponseSchema(BadRequestErrorResponse, { description: 'Bad Request', statusCode: 400 })
  @ResponseSchema(AttemptNotFoundErrorResponse, { description: 'Attempt or Quiz not found', statusCode: 404 })
  @Post('/:quizId/attempt/:attemptId/save')
  async save(
    @Params() params: SaveAttemptParams,
    @Body() body: QuestionAnswersBody,
    @Req() req: any,
  ): Promise<void> {
    const {quizId, attemptId} = params;
    const userId = await this.authService.getUserIdFromReq(req);
    await this.attemptService.save(
      userId,
      quizId,
      attemptId,
      body.answers,
    );
  }

  @OpenAPI({
    summary: 'Submit a quiz attempt',
    description: 'Submits the answers for a quiz attempt and returns the result.',
  })
  @Post('/:quizId/attempt/:attemptId/submit')
  @HttpCode(200)
  @ResponseSchema(SubmitAttemptResponse, {
    description: 'Attempt submitted successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, { description: 'Bad Request', statusCode: 400 })
  @ResponseSchema(AttemptNotFoundErrorResponse, { description: 'Attempt or Quiz not found', statusCode: 404 })
  async submit(
    @Params() params: SubmitAttemptParams,
    @Body() body: QuestionAnswersBody,
    @Req() req: any,
  ): Promise<SubmitAttemptResponse> {
    const {quizId, attemptId} = params;
    const userId = await this.authService.getUserIdFromReq(req);
    console.log('Submitting attempt', {
      userId,
      quizId,
      attemptId,
      answers: body.answers,
    });
    const result = await this.attemptService.submit(
      userId,
      quizId,
      attemptId,
      body.answers,
    );
    return result as SubmitAttemptResponse;
  }

  @OpenAPI({
    summary: 'Get details of a quiz attempt',
    description: 'Retrieves the details of a specific quiz attempt for the current user.',
  })
  @Get('/:quizId/attempt/:attemptId')
  @HttpCode(200)
  @ResponseSchema(GetAttemptResponse, {
    description: 'Attempt retrieved successfully',
    statusCode: 200,
  })
  @ResponseSchema(AttemptNotFoundErrorResponse, { description: 'Attempt not found', statusCode: 404 })
  @ResponseSchema(BadRequestErrorResponse, { description: 'Attempy does not belong to user or quiz', statusCode: 400 })
  async getAttempt(
    @Req() req: any,
    @Params() params: SubmitAttemptParams,
  ): Promise<IAttempt> {
    const {quizId, attemptId} = params;
    const userId = await this.authService.getUserIdFromReq(req);
    const attempt = await this.attemptService.getAttempt(
      userId,
      quizId,
      attemptId,
    );
    return attempt as IAttempt;
  }
}

export {AttemptController};
