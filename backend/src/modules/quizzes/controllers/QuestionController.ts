import {
  QuestionBody,
  QuestionId,
  QuestionFactory,
  QuestionResponse,
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
} from 'routing-controllers';
import {QUIZZES_TYPES} from '#quizzes/types.js';
import {QuestionProcessor} from '#quizzes/question-processing/QuestionProcessor.js';
@JsonController('/questions')
@injectable()
class QuestionController {
  constructor(
    @inject(QUIZZES_TYPES.QuestionService)
    private readonly questionService: QuestionService,
  ) {}

  @Post('/')
  @HttpCode(201)
  async create(@Body() body: QuestionBody): Promise<QuestionId> {
    const question = QuestionFactory.createQuestion(body);
    const questionProcessor = new QuestionProcessor(question);
    questionProcessor.validate();
    questionProcessor.render();
    const id = await this.questionService.create(question);
    return {questionId: id};
  }

  @Get('/:questionId')
  async getById(@Params() params: QuestionId): Promise<QuestionResponse> {
    const {questionId} = params;
    const ques = await this.questionService.getById(questionId, true);
    const questionProcessor = new QuestionProcessor(ques);
    const renderedQues = questionProcessor.render();
    return renderedQues;
  }

  @Put('/:questionId')
  @HttpCode(200)
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
  async delete(@Params() params: QuestionId): Promise<void> {
    const {questionId} = params;
    await this.questionService.delete(questionId);
  }
}

export {QuestionController};
