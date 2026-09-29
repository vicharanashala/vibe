import {QuestionBank} from '#quizzes/classes/transformers/QuestionBank.js';
import { Ability } from '#root/shared/functions/AbilityDecorator.js';
import {
  CreateQuestionBankBody,
  CreateQuestionBankResponse,
  GetQuestionBankByIdParams,
  ExportCourseQuestionBankParams,
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
  UseInterceptor,
  Req,
  Res,
  OnUndefined,
} from 'routing-controllers';
import {Response} from 'express';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {QUIZZES_TYPES} from '#quizzes/types.js';
import { QuestionBankActions, getQuestionBankAbility } from '../abilities/questionBankAbilities.js';
import { subject } from '@casl/ability';
import { BadRequestErrorResponse } from '#root/shared/index.js';
import { AuditTrailsHandler } from '#root/shared/middleware/auditTrails.js';
import { setAuditTrail } from '#root/utils/setAuditTrail.js';
import { AuditAction, AuditCategory, OutComeStatus } from '#root/modules/auditTrails/interfaces/IAuditTrails.js';
import { ObjectId } from 'mongodb';

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
  @UseInterceptor(AuditTrailsHandler)
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
    @Ability(getQuestionBankAbility) {ability, user},
    @Req() req: Request
  ): Promise<CreateQuestionBankResponse> {
    // Build subject context first
    const questionBankContext = { courseId: body.courseId, versionId: body.courseVersionId };
    const questionBankSubject = subject('QuestionBank', questionBankContext);
    
    if (!ability.can(QuestionBankActions.Create, questionBankSubject)) {
      throw new ForbiddenError('You do not have permission to create question banks');
    }

    const questionBank = new QuestionBank(body);
    const questionBankId = await this.questionBankService.create(questionBank);

    setAuditTrail(req, {
      category: AuditCategory.QUESTION_BANK,
      action: AuditAction.QUESTION_BANK_CREATE,
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
      context:{
        courseId: ObjectId.createFromHexString(body.courseId.toString()),
        courseVersionId: ObjectId.createFromHexString(body.courseVersionId.toString()),
      },
      changes:{
        after:{
          questionBankId: ObjectId.createFromHexString(questionBankId.toString()),
          title: body.title,
          description: body.description,
          questionCount: body.questions ? body.questions.length : 0,
        }
      },
      outcome:{
        status: OutComeStatus.SUCCESS,
      } // Assuming user.id is a string representation of ObjectId
    })
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
    summary: 'Export a course version question bank as CSV',
    description: `Exports every question used by the quizzes of a course version, in course order,
    with options, per-option explanations, correct answer and metadata. Intended for instructor review.`,
  })
  @Authorized()
  @Get('/export/courses/:courseId/versions/:versionId')
  @OnUndefined(200)
  async exportCourseVersion(
    @Params() params: ExportCourseQuestionBankParams,
    @Res() res: Response,
    @Ability(getQuestionBankAbility) {ability},
  ): Promise<void> {
    const {courseId, versionId} = params;
    const questionBankSubject = subject('QuestionBank', {courseId, versionId});
    if (!ability.can(QuestionBankActions.View, questionBankSubject)) {
      throw new ForbiddenError(
        'You do not have permission to export this course question bank',
      );
    }

    const {csv, fileName} =
      await this.questionBankService.exportCourseVersionQuestionsCsv(
        courseId,
        versionId,
      );

    res.removeHeader('Content-Type');
    res.status(200);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.setHeader('Cache-Control', 'no-cache');
    res.write(csv);
    res.end();
  }

  @OpenAPI({
    summary: 'Add a question to a question bank',
    description: 'Adds a question to the specified question bank.',
  })
  @Authorized()
  @Patch('/:questionBankId/questions/:questionId/add')
  @UseInterceptor(AuditTrailsHandler)
  @HttpCode(200)
  @ResponseSchema(QuestionBankResponse, {
    description: 'Question added to question bank successfully',
  })
  @ResponseSchema(QuestionBankNotFoundErrorResponse, {
    description: 'Question bank or question not found',
    statusCode: 404,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid input data',
    statusCode: 400,
  })
  async addQuestion(
    @Params() params: QuestionBankAndQuestionParams,
    @Ability(getQuestionBankAbility) {ability, user},
    @Req() req: Request
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

    const quesId = updatedQuestionBank.questions[updatedQuestionBank.questions.length - 1];

    setAuditTrail(req, {
      category: AuditCategory.QUESTION_BANK,
      action: AuditAction.QUESTION_ADD,
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
      context:{
        courseId: ObjectId.createFromHexString(questionBank.courseId.toString()),
        courseVersionId: ObjectId.createFromHexString(questionBank.courseVersionId.toString()),
        questionBankId: ObjectId.createFromHexString(questionBankId.toString()),
      },
      changes:{
        after:{
          questionId: ObjectId.createFromHexString(quesId.toString()),
          title: updatedQuestionBank.title,
          description: updatedQuestionBank.description,
          questionCount: updatedQuestionBank.questions.length,
        }
      },
      outcome:{
        status: OutComeStatus.SUCCESS,
      }
    })
    return updatedQuestionBank;
  }

  @OpenAPI({
    summary: 'Remove a question from a question bank',
    description: 'Removes a question from the specified question bank.',
  })
  @Authorized()
  @Patch('/:questionBankId/questions/:questionId/remove')
  @UseInterceptor(AuditTrailsHandler)
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
    @Ability(getQuestionBankAbility) {ability, user},
    @Req() req: Request
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
    setAuditTrail(req, {
      category: AuditCategory.QUESTION_BANK,
      action: AuditAction.QUESTION_DELETE,
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.roles,
      },
      context:{
        courseId: ObjectId.createFromHexString(questionBank.courseId.toString()),
        courseVersionId: ObjectId.createFromHexString(questionBank.courseVersionId.toString()),
        questionBankId: ObjectId.createFromHexString(questionBankId.toString()),
      },
      changes:{
        before: {
          questionId: ObjectId.createFromHexString(questionId.toString()),
        }
      },
      outcome:{
        status: OutComeStatus.SUCCESS,
      }
    })
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
