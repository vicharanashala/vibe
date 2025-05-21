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
import {QuestionFactory} from '../classes/transformers/Question';
import {QuestionProcessor} from '../question-processing/QuestionProcessor';

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
    try {
      const questionProcessor = new QuestionProcessor(question);
      questionProcessor.validate();

      const renderedQuestion = questionProcessor.render();
      return renderedQuestion;
    } catch (error) {
      throw new BadRequestError((error as Error).message);
    }
  }
}
