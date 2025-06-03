import {
  Body,
  Get,
  JsonController,
  Params,
  Patch,
  Post,
} from 'routing-controllers';
import {QuestionBankService} from '../services/QuestionBankService';
import {inject, injectable} from 'inversify';
import {
  CreateQuestionBankBody,
  CreateQuestionBankResponse,
  GetQuestionBankByIdParams,
  QuestionBankAndQuestionParams,
  QuestionBankResponse,
  ReplaceQuestionResponse,
} from '../classes/validators/QuestionBankValidator';
import {QuestionBank} from '../classes/transformers/QuestionBank';
import {Question} from '../classes';
import TYPES from '../types';
import {exp} from 'mathjs';

@injectable()
@JsonController('/question-bank')
class QuestionBankController {
  constructor(
    @inject(TYPES.QuestionBankService)
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
