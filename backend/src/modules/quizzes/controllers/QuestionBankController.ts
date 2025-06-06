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
import {JsonController, Post, Body, Get, Patch} from 'routing-controllers';
import {QUIZZES_TYPES} from '#quizzes/types.js';
@injectable()
@JsonController('/question-bank')
class QuestionBankController {
  constructor(
    @inject(QUIZZES_TYPES.QuestionBankService)
    private readonly questionBankService: QuestionBankService,
  ) {}

  @Post('/')
  async create(
    @Body() body: CreateQuestionBankBody,
  ): Promise<CreateQuestionBankResponse> {
    const questionBank = new QuestionBank(body);
    const questionBankId = await this.questionBankService.create(questionBank);
    return {questionBankId};
  }

  @Get('/:questionBankId')
  async getById(
    @Body() params: GetQuestionBankByIdParams,
  ): Promise<QuestionBankResponse> {
    const {questionBankId} = params;
    const questionBank = await this.questionBankService.getById(questionBankId);
    return questionBank;
  }

  @Patch('/:questionBankId/questions/:questionId/add')
  async addQuestion(
    @Body() params: QuestionBankAndQuestionParams,
  ): Promise<QuestionBankResponse> {
    const {questionBankId, questionId} = params;
    const updatedQuestionBank = await this.questionBankService.addQuestion(
      questionBankId,
      questionId,
    );
    return updatedQuestionBank;
  }

  @Patch('/:questionBankId/questions/:questionId/remove')
  async removeQuestion(
    @Body() params: QuestionBankAndQuestionParams,
  ): Promise<QuestionBankResponse> {
    const {questionBankId, questionId} = params;
    const updatedQuestionBank = await this.questionBankService.removeQuestion(
      questionBankId,
      questionId,
    );
    return updatedQuestionBank;
  }

  @Patch('/:questionBankId/questions/:questionId/replace-duplicate')
  async replaceQuestion(
    @Body() params: QuestionBankAndQuestionParams,
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
