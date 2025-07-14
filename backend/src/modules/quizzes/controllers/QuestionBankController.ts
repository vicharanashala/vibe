import {QuestionBank} from '#quizzes/classes/transformers/QuestionBank.js';
import { Ability } from '#root/shared/functions/AbilityDecorator.js';
import {
  CreateQuestionBankBody,
  CreateQuestionBankResponse,
  GetQuestionBankByIdParams,
  QuestionBankResponse,
  QuestionBankAndQuestionParams,
  ReplaceQuestionResponse,
  QuestionBankNotFoundErrorResponse,
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
  HttpCode,
  ForbiddenError,
  Authorized,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {QUIZZES_TYPES} from '#quizzes/types.js';
import { QuestionBankActions, getQuestionBankAbility } from '../abilities/questionBankAbilities.js';
import { subject } from '@casl/ability';

@OpenAPI({
  tags: ['Question Banks'],
})
@injectable()
@JsonController('/quizzes/question-bank')
class QuestionBankController {
  constructor(
    @inject(QUIZZES_TYPES.QuestionBankService)
    private readonly questionBankService: QuestionBankService,
  ) {}

  @OpenAPI({
    summary: 'Create a new question bank',
    description: 'Creates a new question bank for organizing quiz questions.',
  })
  @Authorized()
  @Post('/')
  @HttpCode(200)
  @ResponseSchema(CreateQuestionBankResponse, {
    description: 'Question bank created successfully',
    statusCode: 200,
  })
  @ResponseSchema(QuestionBankNotFoundErrorResponse, {
    description: 'Course or course version or some questions not found',
    statusCode: 404,
  })
  async create(
    @Body() body: CreateQuestionBankBody,
    @Ability(getQuestionBankAbility) {ability}
  ): Promise<CreateQuestionBankResponse> {
    // Build subject context first
    const questionBankContext = { courseId: body.courseId, versionId: body.courseVersionId };
    const questionBankSubject = subject('QuestionBank', questionBankContext);
    
    if (!ability.can(QuestionBankActions.Create, questionBankSubject)) {
      throw new ForbiddenError('You do not have permission to create question banks');
    }

    const questionBank = new QuestionBank(body);
    const questionBankId = await this.questionBankService.create(questionBank);
    return {questionBankId};
  }

  @OpenAPI({
    summary: 'Get question bank by ID',
    description: 'Retrieves a question bank and its details by its ID.',
  })
  @Authorized()
  @Get('/:questionBankId')
  @HttpCode(200)
  @ResponseSchema(QuestionBankResponse, {
    description: 'Question bank retrieved successfully',
    statusCode: 200,
  })
  @ResponseSchema(QuestionBankNotFoundErrorResponse, {
    description: 'Question bank not found',
    statusCode: 404,
  })
  async getById(
    @Params() params: GetQuestionBankByIdParams,
    @Ability(getQuestionBankAbility) {ability}
  ): Promise<QuestionBankResponse> {
    const {questionBankId} = params;
    const questionBank = await this.questionBankService.getById(questionBankId);
    const questionBankContext = {courseId: questionBank.courseId, versionId: questionBank.courseVersionId}
    // Build the subject context first
    const questionBankSubject = subject('QuestionBank', questionBankContext);
    
    if (!ability.can(QuestionBankActions.View, questionBankSubject)) {
      throw new ForbiddenError('You do not have permission to view this question bank');
    }
    
    return questionBank;
  }

  @OpenAPI({
    summary: 'Add a question to a question bank',
    description: 'Adds a question to the specified question bank.',
  })
  @Authorized()
  @Patch('/:questionBankId/questions/:questionId/add')
  @HttpCode(200)
  @ResponseSchema(QuestionBankResponse, {
    description: 'Question added to question bank successfully',
  })
  @ResponseSchema(QuestionBankNotFoundErrorResponse, {
    description: 'Question bank or question not found',
    statusCode: 404,
  })
  async addQuestion(
    @Params() params: QuestionBankAndQuestionParams,
    @Ability(getQuestionBankAbility) {ability}
  ): Promise<QuestionBankResponse> {
    const {questionBankId, questionId} = params;

    const questionBank = await this.questionBankService.getById(questionBankId);
    const questionBankContext = {courseId: questionBank.courseId, versionId: questionBank.courseVersionId}
    // Build the subject context first
    const questionBankSubject = subject('QuestionBank', questionBankContext);

    if (!ability.can(QuestionBankActions.Modify, questionBankSubject)) {
      throw new ForbiddenError('You do not have permission to modify this question bank');
    }
    
    const updatedQuestionBank = await this.questionBankService.addQuestion(
      questionBankId,
      questionId,
    );
    return updatedQuestionBank;
  }

  @OpenAPI({
    summary: 'Remove a question from a question bank',
    description: 'Removes a question from the specified question bank.',
  })
  @Authorized()
  @Patch('/:questionBankId/questions/:questionId/remove')
  @HttpCode(200)
  @ResponseSchema(QuestionBankResponse, {
    description: 'Question removed from question bank successfully',
  })
  @ResponseSchema(QuestionBankNotFoundErrorResponse, {
    description: 'Question bank or question not found',
    statusCode: 404,
  })
  async removeQuestion(
    @Params() params: QuestionBankAndQuestionParams,
    @Ability(getQuestionBankAbility) {ability}
  ): Promise<QuestionBankResponse> {
    const {questionBankId, questionId} = params;

    const questionBank = await this.questionBankService.getById(questionBankId);
    const questionBankContext = {courseId: questionBank.courseId, versionId: questionBank.courseVersionId}
    // Build the subject context first
    const questionBankSubject = subject('QuestionBank', questionBankContext);
    
    if (!ability.can(QuestionBankActions.Modify, questionBankSubject)) {
      throw new ForbiddenError('You do not have permission to modify this question bank');
    }
    
    const updatedQuestionBank = await this.questionBankService.removeQuestion(
      questionBankId,
      questionId,
    );
    return updatedQuestionBank;
  }

  @OpenAPI({
    summary: 'Replace a question with its duplicate in a question bank',
    description: 'Duplicates a question and replaces the original in the question bank.',
  })
  @Authorized()
  @Patch('/:questionBankId/questions/:questionId/replace-duplicate')
  @HttpCode(200)
  @ResponseSchema(ReplaceQuestionResponse, {
    description: 'Question replaced with duplicate successfully',
  })
  @ResponseSchema(QuestionBankNotFoundErrorResponse, {
    description: 'Question bank or question not found',
    statusCode: 404,
  })
  async replaceQuestion(
    @Params() params: QuestionBankAndQuestionParams,
    @Ability(getQuestionBankAbility) {ability}
  ): Promise<ReplaceQuestionResponse> {
    const {questionBankId, questionId} = params;
    
    const questionBank = await this.questionBankService.getById(questionBankId);
    const questionBankContext = {courseId: questionBank.courseId, versionId: questionBank.courseVersionId}
    // Build the subject context first
    const questionBankSubject = subject('QuestionBank', questionBankContext);

    if (!ability.can(QuestionBankActions.Modify, questionBankSubject)) {
      throw new ForbiddenError('You do not have permission to modify this question bank');
    }
    
    const id = await this.questionBankService.replaceQuestionWithDuplicate(
      questionBankId,
      questionId,
    );
    return {newQuestionId: id};
  }
}

export {QuestionBankController};
