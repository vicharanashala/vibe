import {NotFoundError} from 'routing-controllers';
import {Service, Inject} from 'typedi';
import {BaseQuestion} from '../classes/transformers';
import {QuestionProcessor} from '../question-processing/QuestionProcessor';
import {IQuestionRenderView} from '../question-processing/renderers';
import {ParameterMap} from '../question-processing/tag-parser';
import {QuestionRepository} from 'shared/database/providers/mongo/repositories/QuestionRepository';

@Service()
class QuestionService {
  constructor(
    @Inject(() => QuestionRepository)
    private questionRepository: QuestionRepository,
  ) {}

  public async create(question: BaseQuestion): Promise<string> {
    return await this.questionRepository.createQuestion(question);
  }

  public async getById(
    questionId: string,
    raw?: boolean,
    parameterMap?: ParameterMap,
  ): Promise<BaseQuestion | IQuestionRenderView> {
    const question = await this.questionRepository.getQuestionById(questionId);
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
