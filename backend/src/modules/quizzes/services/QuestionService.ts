import {NotFoundError} from 'routing-controllers';
import {Service, Inject} from 'typedi';
import {BaseQuestion} from '../classes/transformers';
import {QuestionProcessor} from '../question-processing/QuestionProcessor';
import {IQuestionRenderView} from '../question-processing/renderers';
import {ParameterMap} from '../question-processing/tag-parser';
import {inject, injectable} from 'inversify';
import TYPES from '../types';
import {QuestionRepository} from '../repositories/providers/mongodb/QuestionRepository';

@Service()
@injectable()
class QuestionService {
  constructor(
    @Inject(() => QuestionRepository)
    @inject(TYPES.QuestionRepo)
    private questionRepository: QuestionRepository,
  ) {}

  public async create(question: BaseQuestion): Promise<string> {
    return await this.questionRepository.create(question);
  }

  public async getById(
    questionId: string,
    raw?: boolean,
    parameterMap?: ParameterMap,
  ): Promise<BaseQuestion | IQuestionRenderView> {
    const question = await this.questionRepository.getById(questionId);
    if (!question) {
      throw new NotFoundError(`Question with ID ${questionId} not found`);
    }

    if (raw) {
      return question;
    }

    const questionProcessor = new QuestionProcessor(question);
    return questionProcessor.render(parameterMap);
  }
}

export {QuestionService};
