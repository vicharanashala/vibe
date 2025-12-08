import {
  QuestionBody,
  QuestionId,
  QuestionFactory,
  QuestionResponse,
  QuestionNotFoundErrorResponse,
  FlagQuestionBody,
  FlagId,
  ResolveFlagBody,
  GenerateAIQuestionsBody,
} from '#quizzes/classes/index.js';
import {QuestionService} from '#quizzes/services/QuestionService.js';
import {Ability} from '#root/shared/functions/AbilityDecorator.js';
import {injectable, inject} from 'inversify';
import {
  JsonController,
  Post,
  HttpCode,
  Body,
  Get,
  Params,
  Put,
  Delete,
  OnUndefined,
  BadRequestError,
  ForbiddenError,
  Authorized,
  UploadedFile,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {QUIZZES_TYPES} from '#quizzes/types.js';
import {QuestionProcessor} from '#quizzes/question-processing/QuestionProcessor.js';
import {
  QuestionActions,
  getQuestionAbility,
} from '../abilities/questionAbilities.js';
import {subject} from '@casl/ability';
import {
  BadRequestErrorResponse,
  ForbiddenErrorResponse,
  TranscriptResponse,
} from '#root/shared/index.js';
import {textUploadOptions} from '#root/modules/anomalies/classes/validators/fileUploadOptions.js';

@OpenAPI({
  tags: ['Questions'],
})
@JsonController('/quizzes/questions')
@injectable()
class QuestionController {
  constructor(
    @inject(QUIZZES_TYPES.QuestionService)
    private readonly questionService: QuestionService,
  ) {}

  @OpenAPI({
    summary: 'Create a new question',
    description: 'Creates a new quiz question and returns its ID.',
  })
  @Authorized()
  @Post('/')
  @HttpCode(201)
  @ResponseSchema(QuestionId, {
    description: 'Question created successfully',
    statusCode: 201,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Question creation failed due to invalid body',
    statusCode: 400,
  })
  async create(
    @Body() body: QuestionBody,
    @Ability(getQuestionAbility) {ability, user},
  ): Promise<QuestionId> {
    const userId = user._id.toString();

    if (!ability.can(QuestionActions.Create, 'Question')) {
      throw new ForbiddenError(
        'You do not have permission to create questions',
      );
    }

    const question = QuestionFactory.createQuestion(body, userId);
    const questionProcessor = new QuestionProcessor(question);
    questionProcessor.validate();
    questionProcessor.render();
    const id = await this.questionService.create(question);
    return {questionId: id};
  }

  @OpenAPI({
    summary: 'Get question by ID',
    description: 'Retrieves a quiz question by its ID.',
  })
  @Authorized()
  @Get('/:questionId')
  @ResponseSchema(QuestionResponse, {
    description: 'Question retrieved successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid question id',
    statusCode: 400,
  })
  @ResponseSchema(QuestionNotFoundErrorResponse, {
    description: 'Question not found',
    statusCode: 404,
  })
  async getById(
    @Params() params: QuestionId,
    @Ability(getQuestionAbility) {ability},
  ): Promise<QuestionResponse> {
    const {questionId} = params;

    if (!ability.can(QuestionActions.View, 'Question')) {
      throw new ForbiddenError(
        'You do not have permission to view this question',
      );
    }

    return await this.questionService.getById(questionId, true);
  }

  @OpenAPI({
    summary: 'Update a question',
    description: 'Updates an existing quiz question.',
  })
  @Authorized()
  @Put('/:questionId')
  @HttpCode(200)
  @ResponseSchema(QuestionResponse, {
    description: 'Question updated successfully',
  })
  async update(
    @Params() params: QuestionId,
    @Body() body: QuestionBody,
    @Ability(getQuestionAbility) {ability, user},
  ): Promise<QuestionResponse> {
    const {questionId} = params;
    const userId = user._id.toString();
    const ques = await this.questionService.getById(questionId, true);
    // Build subject context first
    const questionContext = {createdBy: ques.createdBy};
    const questionSubject = subject('Question', questionContext);

    if (!ability.can(QuestionActions.Modify, questionSubject)) {
      throw new ForbiddenError(
        'You do not have permission to modify this question',
      );
    }
    const question = QuestionFactory.createQuestion(body, userId); 
    return await this.questionService.update(questionId, question);
  }

  @OpenAPI({
    summary: 'Delete a question',
    description: `Deletes a quiz question by its ID.<br/>
    It returns an empty body with a 204 status code.`,
  })
  @Authorized()
  @Delete('/:questionId')
  @OnUndefined(204)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid question id',
    statusCode: 400,
  })
  @ResponseSchema(QuestionNotFoundErrorResponse, {
    description: 'Question not found',
    statusCode: 404,
  })
  async delete(
    @Params() params: QuestionId,
    @Ability(getQuestionAbility) {ability},
  ): Promise<void> {
    const {questionId} = params;
    const ques = await this.questionService.getById(questionId, true);
    // Build subject context first
    const questionContext = {createdBy: ques.createdBy};
    const questionSubject = subject('Question', questionContext);

    if (!ability.can(QuestionActions.Delete, questionSubject)) {
      throw new ForbiddenError(
        'You do not have permission to delete this question',
      );
    }

    await this.questionService.delete(questionId);
  }

  @OpenAPI({
    summary: 'Flag a question',
    description: `Flags a quiz question for review with a reason.<br/>
    It returns an empty body with a 200 status code.`,
  })
  @Authorized()
  @Post('/:questionId/flag')
  @OnUndefined(200)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid question id or reason',
    statusCode: 400,
  })
  @ResponseSchema(ForbiddenErrorResponse, {
    description: 'You do not have permission to flag this question',
    statusCode: 403,
  })
  @ResponseSchema(QuestionNotFoundErrorResponse, {
    description: 'Question not found',
    statusCode: 404,
  })
  async flagQuestion(
    @Params() params: QuestionId,
    @Body() body: FlagQuestionBody,
    @Ability(getQuestionAbility) {ability, user},
  ): Promise<void> {
    const {questionId} = params;
    const userId = user._id.toString();

    const questionContext = {questionId};
    const questionSubject = subject('Question', questionContext);

    if (!ability.can(QuestionActions.View, questionSubject)) {
      throw new ForbiddenError(
        'You do not have permission to flag this question',
      );
    }

    await this.questionService.flagQuestion(
      questionId,
      userId,
      body.reason,
      body.courseId,
      body.versionId,
    );
  }

  @OpenAPI({
    summary: 'Resolve a flagged question',
    description: `Resolves a flagged question by marking it as resolved or rejected.<br/>
    It returns an empty body with a 200 status code.`,
  })
  @Authorized()
  @Post('/flags/:flagId/resolve')
  @OnUndefined(200)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid flag id or status',
    statusCode: 400,
  })
  @ResponseSchema(ForbiddenErrorResponse, {
    description: 'You do not have permission to resolve this flag',
    statusCode: 403,
  })
  async resolveFlag(
    @Params() params: FlagId,
    @Body() body: ResolveFlagBody,
    @Ability(getQuestionAbility) {ability, user},
  ): Promise<void> {
    const {flagId} = params;
    const userId = user._id.toString();

    // if (!ability.can(QuestionActions.Modify, 'FlaggedQuestion')) {
    //   throw new ForbiddenError('You do not have permission to resolve this flag');
    // }

    await this.questionService.resolveFlaggedQuestion(
      flagId,
      userId,
      body.status,
    );
  }

  @OpenAPI({
    summary: 'Generate Questions using Claude AI',
    description: `Generates questions based on the provided topic or content.<br/>
    It returns the generated questions array.`,
  })
  // @Authorized()
  @Post('/generate-csv-res')
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid request body or insufficient data',
    statusCode: 400,
  })
  @ResponseSchema(ForbiddenErrorResponse, {
    description: 'You do not have permission to generate questions',
    statusCode: 403,
  })
  async generateAIQuestions(
    @Body() body: GenerateAIQuestionsBody,
  ): Promise<{success: boolean; response: TranscriptResponse[]}> {
    let {text} = body;

    const timestampRegex = /\b\d{2};\d{2};\d{2};\d{2}\s*-\s*\d{2};\d{2};\d{2};\d{2}\b/;

    if (!timestampRegex.test(text)) {
      throw new BadRequestError ("Timestamp range not found. Expected format: HH;MM;SS;FF - HH;MM;SS;FF")
    }

    const chunkTranscriptByTimestamps = (
      transcript: string,
      maxChunkLength = 1500,
    ) => {
      const segmentRegex =
        /\d{2};\d{2};\d{2};\d{2}\s*-\s*\d{2};\d{2};\d{2};\d{2}[\s\S]*?(?=\d{2};\d{2};\d{2};\d{2}\s*-\s*\d{2};\d{2};\d{2};\d{2}|$)/g;
      const segments = transcript.match(segmentRegex) || [];

      const chunks: string[] = [];
      let currentChunk = '';

      for (const segment of segments) {
        if (segment.length > maxChunkLength) {
          // Split by sentence safely
          const sentences = segment.split(/(?<=[.?!])\s+/);
          let subChunk = '';
          for (const sentence of sentences) {
            if ((subChunk + sentence).length > maxChunkLength) {
              chunks.push(subChunk.trim());
              subChunk = '';
            }
            subChunk += sentence + ' ';
          }
          if (subChunk.trim()) chunks.push(subChunk.trim());
          currentChunk = '';
          continue;
        }

        if (
          currentChunk.length + segment.length > maxChunkLength &&
          currentChunk
        ) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        currentChunk += segment.trim() + '\n';
      }

      if (currentChunk.trim()) chunks.push(currentChunk.trim());

      return chunks;
    };

    const chunks = chunkTranscriptByTimestamps(text);
    let allSegments: TranscriptResponse[] = [];
    for (const chunk of chunks) {
      const segments = await this.questionService.generateQuestionsWithAI(
        'userId',
        chunk,
      );
      allSegments = allSegments.concat(segments);
      break
    }

    return {
      success: true,
      response: allSegments,
    };
  }
}

export {QuestionController};
