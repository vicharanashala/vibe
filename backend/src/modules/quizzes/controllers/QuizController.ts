import {
  Body,
  CurrentUser,
  Get,
  JsonController,
  OnUndefined,
  Params,
  Post,
} from 'routing-controllers';
import {QuizService} from '../services/QuizService';
import {IUser} from 'shared/interfaces/Models';
import {
  CreateAttemptParams,
  CreateAttemptResponse,
  QuestionAnswersBody,
  SaveAttemptParams,
  SubmitAttemptParams,
  SubmitAttemptResponse,
} from '../classes/validators/QuizValidator';
import {inject, injectable} from 'inversify';
import TYPES from '../types';

@injectable()
@JsonController('/quizzes')
class QuizController {
  constructor(
    @inject(TYPES.QuizService)
    private readonly quizService: QuizService,
  ) {}

  @Post('/:quizId/attempt')
  async attempt(
    @CurrentUser() user: IUser,
    @Params() params: CreateAttemptParams,
  ): Promise<CreateAttemptResponse> {
    const {quizId} = params;
    const attempt = await this.quizService.attempt(quizId, user.id);
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

    const attempt = await this.quizService.save(
      user.id,
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
    const result = await this.quizService.submit(
      user.id,
      quizId,
      attemptId,
      body.answers,
    );
    return result as SubmitAttemptResponse;
  }
}

export {QuizController};
