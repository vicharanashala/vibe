import {BaseService, MongoDatabase} from '#root/shared/index.js';
import {injectable, inject} from 'inversify';
import {NotFoundError, BadRequestError} from 'routing-controllers';
import {BaseQuestion} from '../classes/index.js';
import {
  ParameterMap,
  IQuestionRenderView,
} from '../question-processing/index.js';
import {QuestionProcessor} from '../question-processing/QuestionProcessor.js';
import {QuestionBankRepository} from '../repositories/index.js';
import {QuestionRepository} from '../repositories/providers/mongodb/QuestionRepository.js';
import TYPES from '../types.js';
import GLOBAL_TYPES from '#root/types.js';

@injectable()
class QuestionService extends BaseService {
  constructor(
    @inject(TYPES.QuestionRepo)
    private questionRepository: QuestionRepository,

    @inject(TYPES.QuestionBankRepo)
    private questionBankRepository: QuestionBankRepository,

    @inject(GLOBAL_TYPES.Database)
    private database: MongoDatabase, // Replace with actual database type if needed
  ) {
    super(database);
  }

  private async _getQuestionBanksByQuestionId() {}

  public async create(question: BaseQuestion): Promise<string> {
    return this._withTransaction(async session => {
      return await this.questionRepository.create(question, session);
    });
  }

  public async getById(
    questionId: string,
    raw?: boolean,
    parameterMap?: ParameterMap,
  ): Promise<BaseQuestion | IQuestionRenderView> {
    return this._withTransaction(async session => {
      const question = await this.questionRepository.getById(
        questionId,
        session,
      );
      if (!question) {
        throw new NotFoundError(`Question with ID ${questionId} not found`);
      }

      if (raw) {
        return question;
      }

      const questionProcessor = new QuestionProcessor(question);
      return questionProcessor.render(parameterMap);
    });
  }

  public async update(
    questionId: string,
    updatedQuestion: BaseQuestion,
  ): Promise<BaseQuestion | null> {
    return this._withTransaction(async session => {
      const question = await this.questionRepository.getById(
        questionId,
        session,
      );
      if (!question) {
        throw new NotFoundError(`Question with ID ${questionId} not found`);
      }
      if (question.type !== updatedQuestion.type) {
        throw new BadRequestError(
          `Cannot change question type from ${question.type} to ${updatedQuestion.type}`,
        );
      }

      const updated = await this.questionRepository.update(
        questionId,
        updatedQuestion,
        session,
      );
      return updated;
    });
  }

  public async delete(questionId: string): Promise<void> {
    return this._withTransaction(async session => {
      const question = await this.questionRepository.getById(
        questionId,
        session,
      );
      if (!question) {
        throw new NotFoundError(`Question with ID ${questionId} not found`);
      }

      // Remove question from all banks
      await this.questionBankRepository.removeQuestionFromAllBanks(
        questionId,
        session,
      );

      // Delete the question
      await this.questionRepository.delete(questionId, session);
    });
  }
}

export {QuestionService};
