import {
  CreateAttemptParams,
  CreateAttemptResponse,
  SaveAttemptParams,
  QuestionAnswersBody,
  SubmitAttemptParams,
  SubmitAttemptResponse,
} from '#quizzes/classes/validators/QuizValidator.js';
import {AttemptService} from '#quizzes/services/AttemptService.js';
import {IUser} from '#shared/index.js';
import {injectable, inject} from 'inversify';
import {
  JsonController,
  Post,
  CurrentUser,
  Params,
  OnUndefined,
  Body,
  Get,
} from 'routing-controllers';
import {QUIZZES_TYPES} from '#quizzes/types.js';
import {IAttempt} from '#quizzes/interfaces/index.js';

@injectable()
@JsonController('/quizzes')
class AttemptController {
  constructor(
    @inject(QUIZZES_TYPES.AttemptService)
    private readonly attemptService: AttemptService,
  ) {}

  @Post('/:quizId/attempt')
  async attempt(
    @CurrentUser() user: IUser,
    @Params() params: CreateAttemptParams,
  ): Promise<CreateAttemptResponse> {
    const {quizId} = params;
    const attempt = await this.attemptService.attempt(user._id, quizId);
    return attempt as CreateAttemptResponse;
  }

  @OnUndefined(200)
  @Post('/:quizId/attempt/:attemptId/save')
  async save(
    @CurrentUser() user: IUser,
    @Params() params: SaveAttemptParams,
    @Body() body: QuestionAnswersBody,
  ): Promise<void> {
    const {quizId, attemptId} = params;

    const attempt = await this.attemptService.save(
      user._id,
      quizId,
      attemptId,
      body.answers,
    );
  }

  @Post('/:quizId/attempt/:attemptId/submit')
  async submit(
    @CurrentUser() user: IUser,
    @Params() params: SubmitAttemptParams,
    @Body() body: QuestionAnswersBody,
  ): Promise<SubmitAttemptResponse> {
    const {quizId, attemptId} = params;
    const result = await this.attemptService.submit(
      user._id,
      quizId,
      attemptId,
      body.answers,
    );
    return result as SubmitAttemptResponse;
  }

  @Get('/:quizId/attempt/:attemptId')
  async getAttempt(
    @CurrentUser() user: IUser,
    @Params() params: SubmitAttemptParams,
  ): Promise<IAttempt> {
    const {quizId, attemptId} = params;
    const attempt = await this.attemptService.getAttempt(
      user._id,
      quizId,
      attemptId,
    );
    return attempt as IAttempt;
  }
}

export {AttemptController};
