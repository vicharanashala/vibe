import {
  Body,
  CurrentUser,
  Get,
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
} from '#quizzes/classes/validators/QuizValidator.js';
import {IUser} from '#shared/interfaces/models.js';
import {QUIZZES_TYPES} from '#quizzes/types.js';
import {IAttempt} from '#quizzes/interfaces/index.js';
import {AUTH_TYPES} from '#auth/types.js';
import {FirebaseAuthService} from '#auth/services/FirebaseAuthService.js';

@injectable()
@JsonController('/quizzes')
class AttemptController {
  constructor(
    @inject(QUIZZES_TYPES.AttemptService)
    private readonly attemptService: AttemptService,
    @inject(AUTH_TYPES.AuthService)
    private readonly authService: FirebaseAuthService,
  ) {}

  @Post('/:quizId/attempt')
  async attempt(
    @Req() req: any,
    @Params() params: CreateAttemptParams,
  ): Promise<CreateAttemptResponse> {
    const {quizId} = params;
    const userId = await this.authService.getUserIdFromReq(req);
    const attempt = await this.attemptService.attempt(userId, quizId);
    return attempt as CreateAttemptResponse;
  }

  @OnUndefined(200)
  @Post('/:quizId/attempt/:attemptId/save')
  async save(
    @Params() params: SaveAttemptParams,
    @Body() body: QuestionAnswersBody,
    @Req() req: any,
  ): Promise<void> {
    const {quizId, attemptId} = params;
    const userId = await this.authService.getUserIdFromReq(req);
    const attempt = await this.attemptService.save(
      userId,
      quizId,
      attemptId,
      body.answers,
    );
  }

  @Post('/:quizId/attempt/:attemptId/submit')
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

  @Get('/:quizId/attempt/:attemptId')
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
