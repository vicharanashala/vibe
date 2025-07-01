import {
  Body,
  Get,
  HttpCode,
  JsonController,
  OnUndefined,
  Params,
  Post,
  ForbiddenError,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import { Ability } from '#root/shared/functions/AbilityDecorator.js';
import {AttemptService} from '#quizzes/services/AttemptService.js';
import {injectable, inject} from 'inversify';
import { AttemptActions, getAttemptAbility } from '../abilities/attemptAbilities.js';
import { subject } from '@casl/ability';
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
    @Params() params: CreateAttemptParams,
    @Ability(getAttemptAbility) {ability, user}
  ): Promise<CreateAttemptResponse> {
    const {quizId} = params;
    const userId = user._id.toString();
    // Build subject context first
    const attemptSubject = subject('Attempt', {quizId});
    
    if (!ability.can(AttemptActions.Start, attemptSubject)) {
      throw new ForbiddenError('You do not have permission to start this quiz attempt');
    }
    
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
    @Ability(getAttemptAbility) {ability, user}
  ): Promise<void> {
    const {quizId, attemptId} = params;
    const userId = user._id.toString();
    // Build subject context first
    const attemptSubject = subject('Attempt', {quizId});
    
    if (!ability.can(AttemptActions.Save, attemptSubject)) {
      throw new ForbiddenError('You do not have permission to save this quiz attempt');
    }
    
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
    @Ability(getAttemptAbility) {ability, user}
  ): Promise<SubmitAttemptResponse> {
    const {quizId, attemptId} = params;
    const userId = user._id.toString();
    
    // Build subject context first
    const attemptSubject = subject('Attempt', {quizId});
    
    if (!ability.can(AttemptActions.Submit, attemptSubject)) {
      throw new ForbiddenError('You do not have permission to submit this quiz attempt');
    }
    
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
    @Params() params: SubmitAttemptParams,
    @Ability(getAttemptAbility) {ability, user}
  ): Promise<IAttempt> {
    const {quizId, attemptId} = params;
    const userId = user._id.toString();
    
    // Build subject context first
    const attemptSubject = subject('Attempt', {quizId});
    
    if (!ability.can(AttemptActions.View, attemptSubject)) {
      throw new ForbiddenError('You do not have permission to view this quiz attempt');
    }
    
    const attempt = await this.attemptService.getAttempt(
      userId,
      quizId,
      attemptId,
    );
    return attempt as IAttempt;
  }
}

export {AttemptController};
