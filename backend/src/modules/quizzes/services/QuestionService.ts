import { injectable, inject } from 'inversify';
import { NotFoundError, BadRequestError } from 'routing-controllers';
import { QUIZZES_TYPES } from '../types.js';
import { BaseService } from '#root/shared/classes/BaseService.js';
import { QuestionRepository } from '../repositories/providers/mongodb/QuestionRepository.js';
import { QuestionBankRepository } from '../repositories/providers/mongodb/QuestionBankRepository.js';
import { AttemptRepository } from '../repositories/providers/mongodb/AttemptRepository.js';
import { UserQuizMetricsRepository } from '../repositories/providers/mongodb/UserQuizMetricsRepository.js';
import { MongoDatabase } from '#root/shared/database/providers/mongo/MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { ParameterMap } from '../question-processing/tag-parser/tags/Tag.js';
import { BaseQuestion } from '../classes/transformers/Question.js';
import { IQuestionRenderView } from '../question-processing/renderers/interfaces/RenderViews.js';
import { QuestionProcessor } from '../question-processing/QuestionProcessor.js';
import { QuizRepository } from '../repositories/providers/mongodb/QuizRepository.js';
import { ClientSession } from 'mongodb';

@injectable()
class QuestionService extends BaseService {
  constructor(
    @inject(QUIZZES_TYPES.QuestionRepo)
    private questionRepository: QuestionRepository,

    @inject(QUIZZES_TYPES.QuestionBankRepo)
    private questionBankRepository: QuestionBankRepository,

    @inject(QUIZZES_TYPES.AttemptRepo)
    private attemptRepository: AttemptRepository,
    @inject(QUIZZES_TYPES.UserQuizMetricsRepo)
    private userQuizMetricsRepository: UserQuizMetricsRepository,

    @inject(QUIZZES_TYPES.QuizRepo)
    private quizRepository: QuizRepository,

    @inject(GLOBAL_TYPES.Database)
    private database: MongoDatabase, // Replace with actual database type if needed
  ) {
    super(database);
  }

  private async _getQuestionBanksByQuestionId() { }

  private async _getQuestionSkipCount(
    questionId: string,
    session?: ClientSession,
  ): Promise<number> {
    try {
      const questionBanks = await this.questionBankRepository.getQuestionBanksByQuestionId(
        questionId,
        session,
      );

      if (!questionBanks || questionBanks.length === 0) {
        return 0;
      }

      const questionBankIds = questionBanks.map(bank => bank._id?.toString()).filter(Boolean);

      if (questionBankIds.length === 0) {
        return 0;
      }

      let totalSkipCount = 0;

      const allMetrics = await this.userQuizMetricsRepository.getAll(session);

      for (const metric of allMetrics) {

        const quiz = await this.quizRepository.getById(metric.quizId.toString(), session);
        if (quiz && quiz.details.allowSkip) {
          const hasQuestion = quiz.details.questionBankRefs.some(ref =>
            questionBankIds.includes(ref.bankId)
          );
          if (hasQuestion) {
            totalSkipCount += metric.skipCount || 0;
          }
        }
      }

      return totalSkipCount;
    } catch (error) {
      console.error('Error calculating question skip count:', error);
      return 0;
    }
  }

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

    return this._withTransaction(async (session) => {
      const question = await this.questionRepository.getById(questionId, session);
      if (!question) {
        throw new NotFoundError(`Question with ID ${questionId} not found`);
      }

      const [attemptCount, attemptedByUsersCount] = await Promise.all([
        this.attemptRepository.countByQuestionId(questionId, session),
        this.attemptRepository.countDistinctUsersByQuestionId(questionId, session),
      ]);

      if (raw) {
        const skipCount = await this._getQuestionSkipCount(questionId, session);

        return {
          ...(question as BaseQuestion),
          attemptCount,
          attemptedByUsersCount,
          skipCount,
        } as unknown as BaseQuestion;
      }

      const questionProcessor = new QuestionProcessor(question);
      const rendered = questionProcessor.render(parameterMap) as IQuestionRenderView;
    
      return {
        ...rendered,
        attemptCount,
        attemptedByUsersCount,
      };
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
      updated._id = updated._id.toString();
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

  public async flagQuestion(
    questionId: string,
    userId: string,
    reason: string,
    courseId?: string,
    versionId?: string,
  ): Promise<void> {
    return this._withTransaction(async session => {
      const question = await this.questionRepository.getById(
        questionId,
        session,
      );
      if (!question) {
        throw new NotFoundError(`Question with ID ${questionId} not found`);
      }

      // Flag the question with the reason and user ID
      await this.questionRepository.flagQuestion(
        questionId,
        userId,
        reason,
        session,
        courseId,
        versionId,
      );
    });
  }

  public async resolveFlaggedQuestion(
    flagId: string,
    userId: string,
    status: 'RESOLVED' | 'REJECTED',
  ): Promise<void> {
    return this._withTransaction(async session => {
      const flaggedQuestion = await this.questionRepository.getFlaggedQuestionById(
        flagId,
        session,
      );
      if (!flaggedQuestion) {
        throw new NotFoundError(
          `Flagged question not found`,
        );
      }

      // Update the flagged question status and resolvedBy
      await this.questionRepository.updateFlaggedQuestion(
        flagId,
        {status, resolvedBy: userId, resolvedAt: new Date()},
        session,
      );
    });
  }
}

export {QuestionService};
