import {QuestionBank} from '#quizzes/classes/transformers/QuestionBank.js';
import {
  CreateQuestionBankBody,
  CreateQuestionBankResponse,
  GetQuestionBankByIdParams,
  QuestionBankResponse,
  QuestionBankAndQuestionParams,
  ReplaceQuestionResponse,
} from '#quizzes/classes/validators/QuestionBankValidator.js';
import {QuestionBankService} from '#quizzes/services/QuestionBankService.js';
import {injectable, inject} from 'inversify';
import {
  JsonController,
  Post,
  Body,
  Get,
  Patch,
  Params,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {QUIZZES_TYPES} from '#quizzes/types.js';

@OpenAPI({
  tags: ['Question Banks'],
})
@injectable()
@JsonController('/question-bank')
class QuestionBankController {
  constructor(
    @inject(QUIZZES_TYPES.QuestionBankService)
    private readonly questionBankService: QuestionBankService,
  ) {}

  @Post('/')
  @OpenAPI({
    summary: 'Create a new question bank',
    description:
      'Create a new question bank with the provided details. The question bank can be associated with a course and contain multiple questions.',
    requestBody: {
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/CreateQuestionBankBody',
          },
        },
      },
    },
  })
  @ResponseSchema(CreateQuestionBankResponse, {
    description: 'Question bank created successfully',
  })
  async create(
    @Body() body: CreateQuestionBankBody,
  ): Promise<CreateQuestionBankResponse> {
    const questionBank = new QuestionBank(body);
    const questionBankId = await this.questionBankService.create(questionBank);
    return {questionBankId};
  }

  @Get('/:questionBankId')
  @OpenAPI({
    summary: 'Get question bank by ID',
    description: 'Retrieve a specific question bank by its unique identifier.',
  })
  @ResponseSchema(QuestionBankResponse, {
    description: 'Question bank retrieved successfully',
  })
  async getById(
    @Params() params: GetQuestionBankByIdParams,
  ): Promise<QuestionBankResponse> {
    const {questionBankId} = params;
    const questionBank = await this.questionBankService.getById(questionBankId);
    return questionBank;
  }

  @Patch('/:questionBankId/questions/:questionId/add')
  @OpenAPI({
    summary: 'Add question to question bank',
    description:
      'Add an existing question to a question bank. The question must already exist in the system.',
  })
  @ResponseSchema(QuestionBankResponse, {
    description: 'Question added to question bank successfully',
  })
  async addQuestion(
    @Params() params: QuestionBankAndQuestionParams,
  ): Promise<QuestionBankResponse> {
    const {questionBankId, questionId} = params;
    const updatedQuestionBank = await this.questionBankService.addQuestion(
      questionBankId,
      questionId,
    );
    return updatedQuestionBank;
  }

  @Patch('/:questionBankId/questions/:questionId/remove')
  @OpenAPI({
    summary: 'Remove question from question bank',
    description:
      'Remove a question from a question bank. The question itself is not deleted, only the association is removed.',
  })
  @ResponseSchema(QuestionBankResponse, {
    description: 'Question removed from question bank successfully',
  })
  async removeQuestion(
    @Params() params: QuestionBankAndQuestionParams,
  ): Promise<QuestionBankResponse> {
    const {questionBankId, questionId} = params;
    const updatedQuestionBank = await this.questionBankService.removeQuestion(
      questionBankId,
      questionId,
    );
    return updatedQuestionBank;
  }

  @Patch('/:questionBankId/questions/:questionId/replace-duplicate')
  @OpenAPI({
    summary: 'Replace question with duplicate',
    description:
      'Replace a question in the question bank with a duplicate copy. This creates a new question instance while maintaining the same content.',
  })
  @ResponseSchema(ReplaceQuestionResponse, {
    description: 'Question replaced with duplicate successfully',
  })
  async replaceQuestion(
    @Params() params: QuestionBankAndQuestionParams,
  ): Promise<ReplaceQuestionResponse> {
    const {questionBankId, questionId} = params;
    const id = await this.questionBankService.replaceQuestionWithDuplicate(
      questionBankId,
      questionId,
    );
    return {newQuestionId: id};
  }
}

export {QuestionBankController};
