import {
  Body,
  Get,
  HttpCode,
  OnUndefined,
  Params,
  Post,
  ForbiddenError,
  Authorized,
  Res,
  Controller,
  Req,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Ability } from '#root/shared/functions/AbilityDecorator.js';
import { AttemptService } from '#quizzes/services/AttemptService.js';
import { injectable, inject } from 'inversify';
import {
  AttemptActions,
  getAttemptAbility,
} from '../abilities/attemptAbilities.js';
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
  SubmitFeedbackParams,
  SubmitFeedbackBody,
  ExportQuizAttemptsParams,
  QuestionAnswersBodydto,
} from '#quizzes/classes/validators/QuizValidator.js';
import { QUIZZES_TYPES } from '#quizzes/types.js';
import { IAttempt } from '#quizzes/interfaces/index.js';
import { BadRequestErrorResponse } from '#root/shared/index.js';
import { getCourseAbility } from '#root/modules/courses/abilities/courseAbilities.js';
import { createObjectCsvStringifier } from 'csv-writer';
import { Response, Request } from 'express';
import {hideExplanationForStartAttempt} from '../utils/functions/hideExplanationForStartAttempt.js';

@OpenAPI({
  tags: ['Quiz Attempts'],
})
@injectable()
@Controller('/quizzes')
class AttemptController {
  constructor(
    @inject(QUIZZES_TYPES.AttemptService)
    private readonly attemptService: AttemptService,
  ) { }

  @OpenAPI({
    summary: 'Start a new quiz attempt',
    description:
      'Creates a new attempt for the specified quiz for the current user.',
  })
  @Authorized()
  @Post('/:quizId/attempt')
  @HttpCode(200)
  @ResponseSchema(CreateAttemptResponse, {
    description: 'Attempt created successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request',
    statusCode: 400,
  })
  @ResponseSchema(AttemptNotFoundErrorResponse, {
    description: 'Quiz not found',
    statusCode: 404,
  })
  async attempt(
    @Params() params: CreateAttemptParams,
    @Ability(getAttemptAbility) { ability, user },
  ): Promise<CreateAttemptResponse> {
    const { quizId } = params;
    const userId = user._id.toString();

    // Build subject context first
    const attemptSubject = subject('Attempt', { quizId });

    if (!ability.can(AttemptActions.Start, attemptSubject)) {
      throw new ForbiddenError(
        'You do not have permission to start this quiz attempt',
      );
    }

    const attempt = await this.attemptService.attempt(userId, quizId);

    return hideExplanationForStartAttempt(attempt) as CreateAttemptResponse;
    // return attempt as CreateAttemptResponse;
  }

  @OpenAPI({
    summary: 'Save answers for an ongoing attempt',
    description: `Saves the current answers for a quiz attempt without submitting.<br/>
      It returns an empty body with a 200 status code.`,
  })
  @Authorized()
  @OnUndefined(200)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request',
    statusCode: 400,
  })
  @ResponseSchema(AttemptNotFoundErrorResponse, {
    description: 'Attempt or Quiz not found',
    statusCode: 404,
  })
  @Post('/:quizId/attempt/:attemptId/save')
  async save(
    @Req() req: Request,
    @Res() res: Response,
    @Params() params: SaveAttemptParams,
    // @Body() body: QuestionAnswersBody,
    @Ability(getAttemptAbility) { ability, user },
  ): Promise<{
    result: 'CORRECT' | 'INCORRECT' | 'PARTIALLY_CORRECT';
    explanation?: string;
  }> {
    const body: QuestionAnswersBodydto = await new Promise(
      (resolve, reject) => {
        let data = '';
        req.on('data', chunk => {
          data += chunk;
        });
        req.on('end', () => {
          try {
            resolve(JSON.parse(data || '{}') as QuestionAnswersBodydto);
          } catch (err) {
            reject(err);
          }
        });
        req.on('error', err => reject(err));
      },
    );
    const { quizId, attemptId } = params;
    const userId = user._id.toString();
    // Build subject context first
    const attemptSubject = subject('Attempt', { quizId });

    if (!ability.can(AttemptActions.Save, attemptSubject)) {
      throw new ForbiddenError(
        'You do not have permission to save this quiz attempt',
      );
    }

    const result = await this.attemptService.save(
      userId,
      quizId,
      attemptId,
      body.answers,
    );

    return result;
  }

  @OpenAPI({
    summary: 'Submit a quiz attempt',
    description:
      'Submits the answers for a quiz attempt and returns the result.',
  })
  @Authorized()
  @Post('/:quizId/attempt/:attemptId/submit')
  @HttpCode(200)
  @ResponseSchema(SubmitAttemptResponse, {
    description: 'Attempt submitted successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request',
    statusCode: 400,
  })
  @ResponseSchema(AttemptNotFoundErrorResponse, {
    description: 'Attempt or Quiz not found',
    statusCode: 404,
  })
  async submit(
    @Req() req: Request,
    @Res() res: Response,
    @Params() params: SubmitAttemptParams,
    // @Body() body: QuestionAnswersBody,
    @Ability(getAttemptAbility) { ability, user },
  ): Promise<SubmitAttemptResponse> {
    const { quizId, attemptId } = params;
    const body: QuestionAnswersBodydto = await new Promise(
      (resolve, reject) => {
        let data = '';
        req.on('data', chunk => {
          data += chunk;
        });
        req.on('end', () => {
          try {
            resolve(JSON.parse(data || '{}') as QuestionAnswersBodydto);
          } catch (err) {
            reject(err);
          }
        });
        req.on('error', err => reject(err));
      },
    );
    const { isSkipped, answers, courseId, courseVersionId, watchItemId , courseId, courseVersionId} = body;
    const userId = user._id.toString();
    // Build subject context first
    const attemptSubject = subject('Attempt', { quizId });

    if (!ability.can(AttemptActions.Submit, attemptSubject)) {
      throw new ForbiddenError(
        'You do not have permission to submit this quiz attempt',
      );
    }

    const result = await this.attemptService.submit(
      userId,
      quizId,
      attemptId,
      answers,
      isSkipped,
      courseId,
      courseVersionId,
      watchItemId
      courseId,
      courseVersionId
    );
    return result as SubmitAttemptResponse;
  }

  @OpenAPI({
    summary: 'Submit feedback for an item',
    description:
      'Submits the feedback form response for a given item and stores the results.',
  })
  @Authorized()
  @Post('/:itemId/feedback/submit')
  @HttpCode(200)
  @ResponseSchema(SubmitAttemptResponse, {
    description: 'Feedback submitted successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid feedback submission request',
    statusCode: 400,
  })
  @ResponseSchema(AttemptNotFoundErrorResponse, {
    description: 'Attempt or feedback form not found',
    statusCode: 404,
  })
  async submitFeedback(
    @Params() params: SubmitFeedbackParams,
    @Body() body: SubmitFeedbackBody,
    @Ability(getCourseAbility) { ability, user },
  ): Promise<string> {
    const { itemId } = params;
    const { details, courseId, courseVersionId, sectionId } = body;
    const userId = user._id.toString();

    return await this.attemptService.submitFeedBackForm(
      userId,
      courseId,
      courseVersionId,
      itemId,
      details,
      // isSkipped,
    );
  }

  @OpenAPI({
    summary: 'Get details of a quiz attempt',
    description:
      'Retrieves the details of a specific quiz attempt for the current user.',
  })
  @Authorized()
  @Get('/:quizId/attempt/:attemptId')
  @HttpCode(200)
  @ResponseSchema(GetAttemptResponse, {
    description: 'Attempt retrieved successfully',
    statusCode: 200,
  })
  @ResponseSchema(AttemptNotFoundErrorResponse, {
    description: 'Attempt not found',
    statusCode: 404,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Attempy does not belong to user or quiz',
    statusCode: 400,
  })
  async getAttempt(
    @Params() params: SubmitAttemptParams,
    @Ability(getAttemptAbility) { ability, user },
  ): Promise<IAttempt> {
    const { quizId, attemptId } = params;
    const userId = user._id.toString();

    // Build subject context first
    const attemptSubject = subject('Attempt', { quizId });

    if (!ability.can(AttemptActions.View, attemptSubject)) {
      throw new ForbiddenError(
        'You do not have permission to view this quiz attempt',
      );
    }

    const attempt = await this.attemptService.getAttempt(
      userId,
      quizId,
      attemptId,
    );
    return attempt as IAttempt;
  }

  @Get('/:quizId/attempts/export')
  @OnUndefined(200)
  @OpenAPI({
    summary: 'Export quiz attempts as CSV',
    description: 'Exports all attempts for a specific quiz.',
  })
  async exportQuizAttempts(
    @Params() params: ExportQuizAttemptsParams,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.attemptService.exportQuizSubmissions(
      params.quizId,
    );

    const header = [
      { id: 'Name', title: 'Name' },
      { id: 'Question', title: 'Question' },
      { id: 'questionType', title: 'Question Type' },
      { id: 'Response', title: 'Response' },
    ];

    const csvStringifier = createObjectCsvStringifier({
      header: header,
    });

    const csvContent =
      csvStringifier.getHeaderString() +
      csvStringifier.stringifyRecords(result);

    // Clear any existing headers and set new ones
    res.removeHeader('Content-Type');
    res.status(200);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="quiz_attempts.csv"',
    );
    res.setHeader('Cache-Control', 'no-cache');
    res.write(csvContent);
    res.end();
  }
}

export { AttemptController };
