import {
  QuestionBody,
  QuestionId,
  QuestionFactory,
  QuestionResponse,
  QuestionNotFoundErrorResponse,
} from '#quizzes/classes/index.js';
import {QuestionService} from '#quizzes/services/QuestionService.js';
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
  Authorized,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {QUIZZES_TYPES} from '#quizzes/types.js';
import {QuestionProcessor} from '#quizzes/question-processing/QuestionProcessor.js';

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
  @Authorized(['admin', 'instructor'])
  @Post('/')
  @HttpCode(201)
  @ResponseSchema(QuestionId, {
    description: 'Question created successfully',
    statusCode: 201,
  })
  @ResponseSchema(BadRequestError, {
    description: 'Question creation failed due to invalid body',
    statusCode: 400,
  })
  async create(@Body() body: QuestionBody): Promise<QuestionId> {
    const question = QuestionFactory.createQuestion(body);
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
  @Get('/:questionId')
  @ResponseSchema(QuestionResponse, {
    description: 'Question retrieved successfully',
  })
  @ResponseSchema(BadRequestError, {
    description: 'Invalid question id',
    statusCode: 400,
  })
  @ResponseSchema(QuestionNotFoundErrorResponse, {
    description: 'Question not found',
    statusCode: 404,
  })
  async getById(@Params() params: QuestionId): Promise<QuestionResponse> {
    const {questionId} = params;
    const ques = await this.questionService.getById(questionId, true);
    const questionProcessor = new QuestionProcessor(ques);
    const renderedQues = questionProcessor.render();
    return renderedQues;
  }

  @OpenAPI({
    summary: 'Update a question',
    description: 'Updates an existing quiz question.',
  })
  @Authorized(['admin', 'instructor'])
  @Put('/:questionId')
  @HttpCode(200)
  @ResponseSchema(QuestionResponse, {
    description: 'Question updated successfully',
  })
  async update(
    @Params() params: QuestionId,
    @Body() body: QuestionBody,
  ): Promise<QuestionResponse> {
    const {questionId} = params;
    const question = QuestionFactory.createQuestion(body);
    return await this.questionService.update(questionId, question);
  }

  @OpenAPI({
    summary: 'Delete a question',
    description: 'Deletes a quiz question by its ID.',
  })
  @Authorized(['admin', 'instructor'])
  @Delete('/:questionId')
  @OnUndefined(204)
  @ResponseSchema(BadRequestError, {
    description: 'Invalid question id',
    statusCode: 400,
  })
  @ResponseSchema(QuestionNotFoundErrorResponse, {
    description: 'Question not found',
    statusCode: 404,
  })
  async delete(@Params() params: QuestionId): Promise<void> {
    const {questionId} = params;
    await this.questionService.delete(questionId);
  }
}

export {QuestionController};
