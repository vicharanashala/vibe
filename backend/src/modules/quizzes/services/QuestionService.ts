import {BaseQuestion} from '#quizzes/classes/index.js';
import {
  ParameterMap,
  IQuestionRenderView,
} from '#quizzes/question-processing/index.js';
import {QuestionProcessor} from '#quizzes/question-processing/QuestionProcessor.js';
import {
  QuestionRepository,
  QuestionBankRepository,
} from '#quizzes/repositories/index.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {BaseService, MongoDatabase} from '#shared/index.js';
import {injectable, inject} from 'inversify';
import {NotFoundError, BadRequestError} from 'routing-controllers';
import {QUIZZES_TYPES} from '../types.js';

@injectable()
class QuestionService extends BaseService {
  constructor(
    @inject(QUIZZES_TYPES.QuestionRepo)
    private questionRepository: QuestionRepository,

    @inject(QUIZZES_TYPES.QuestionBankRepo)
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
      const {_id, ...questionData} = updatedQuestion;
      const updated = await this.questionRepository.update(
        questionId,
        questionData,
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
