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
} from 'routing-controllers';
import {Service, Inject} from 'typedi';
import {CreateQuestionBody} from '../classes/validators/QuestionValidator';
import {BadRequestErrorResponse} from 'shared/middleware/errorHandler';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {QuestionFactory} from '../classes/transformers/Question';
import {QuestionValidationService} from '../services/QuestionValidationService';
import {StudentQuestionRenderingStrategy} from '../rendering/QuestionProcessor';
import {NumExprProcessor} from '../rendering/processors/NumExprProcessor';
import {NumExprTexProcessor} from '../rendering/processors/NumExprTexProcessor';
import {QParamProcessor} from '../rendering/processors/QParamProcessor';
import {TagParserEngine} from '../rendering/TagParserEngine';

@JsonController('/questions')
@Service()
export class QuestionController {
  constructor() {}

  @Authorized(['admin', 'instructor'])
  @Post('/', {transformResponse: true})
  @HttpCode(201)
  @OnUndefined(201)
  async create(@Body() body: CreateQuestionBody) {
    const question = QuestionFactory.createQuestion(body);

    const tagParserEngine = new TagParserEngine({
      QParam: new QParamProcessor(),
      NumExpr: new NumExprProcessor(),
      NumExprTex: new NumExprTexProcessor(),
    });

    const businessRulesValidator = QuestionValidationService.resolve(
      question,
      tagParserEngine,
    );
    try {
      businessRulesValidator.validate();
      const renderStrategy = new StudentQuestionRenderingStrategy();
      const renderedQuestion = renderStrategy.render(question);
      return renderedQuestion;
    } catch (error) {
      throw new BadRequestError((error as Error).message);
    }
  }
}
