import 'reflect-metadata';
import {
  JsonController,
  Authorized,
  Post,
  Body,
  Get,
  Put,
  Delete,
  Params,
  HttpCode,
  OnUndefined,
  BadRequestError,
  Patch,
} from 'routing-controllers';
import {
  QuestionBody,
  QuestionId,
  QuestionResponse,
} from '../classes/validators/QuestionValidator';
import {QuestionFactory} from '../classes/transformers/Question';
import {QuestionProcessor} from '../question-processing/QuestionProcessor';
import {inject, injectable} from 'inversify';
import TYPES from '../types';
import {QuestionService} from '../services/QuestionService';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';

@OpenAPI({
  tags: ['Questions'],
})
@JsonController('/questions')
@injectable()
class QuestionController {
  constructor(
    @inject(TYPES.QuestionService)
    private readonly questionService: QuestionService,
  ) {}

  @Post('/')
  @HttpCode(201)
  @OpenAPI({
    summary: 'Create a new question',
    description: 'Create a new quiz question with specified type and content',
    requestBody: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/QuestionBody',
          },
        },
      },
    },
  })
  @ResponseSchema(QuestionId, {
    description: 'Question created successfully',
  })
  async create(@Body() body: QuestionBody): Promise<QuestionId> {
    const question = QuestionFactory.createQuestion(body);
    const questionProcessor = new QuestionProcessor(question);
    questionProcessor.validate();
    questionProcessor.render();
    const id = await this.questionService.create(question);
    return {questionId: id};
  }

  @Get('/:questionId')
  @OpenAPI({
    summary: 'Get question by ID',
    description: 'Retrieve a specific question by its unique identifier',
  })
  @ResponseSchema(QuestionResponse, {
    description: 'Question retrieved successfully',
  })
  async getById(@Params() params: QuestionId): Promise<QuestionResponse> {
    const {questionId} = params;
    return this.questionService.getById(questionId, true);
  }

  @Put('/:questionId')
  @HttpCode(200)
  @OpenAPI({
    summary: 'Update question',
    description: 'Update an existing question with new content or properties',
    requestBody: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/QuestionBody',
          },
        },
      },
    },
  })
  @ResponseSchema(QuestionResponse, {
    description: 'Question updated successfully',
  })
  async update(
    @Params() params: QuestionId,
    @Body() body: QuestionBody,
  ): Promise<QuestionResponse> {
    const {questionId} = params;
    const question = QuestionFactory.createQuestion(body);
    return this.questionService.update(questionId, question);
  }

  @Delete('/:questionId')
  @OnUndefined(204)
  @OpenAPI({
    summary: 'Delete question',
    description: 'Remove a question from the system',
  })
  async delete(@Params() params: QuestionId): Promise<void> {
    const {questionId} = params;
    await this.questionService.delete(questionId);
  }
}

export {QuestionController};
