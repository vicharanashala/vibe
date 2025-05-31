import {ID, IQuestionBank} from 'shared/interfaces/quiz';
import {CreateQuestionBankBody} from '../classes/validators/QuestionBankValidator';
import {QuestionBankRepository} from '../repositories/providers/mongodb/QuestionBankRepository';
import {QuestionRepository} from '../repositories/providers/mongodb/QuestionRepository';
import {BaseQuestion} from '../classes';
import {MongoDatabase} from 'shared/database/providers/MongoDatabaseProvider';
import {BaseService} from 'shared/classes/BaseService';
import {QuestionBank} from '../classes/transformers/QuestionBank';
import {CourseRepository} from 'shared/database/providers/mongo/repositories/CourseRepository';
import {NotFoundError} from 'routing-controllers';
import TYPES from '../types';
import {inject, injectable} from 'inversify';

import GLOBAL_TYPES from '../../../types';

@injectable()
class QuestionBankService extends BaseService {
  constructor(
    @inject(TYPES.QuestionBankRepo)
    private readonly questionBankRepository: QuestionBankRepository,

    @inject(TYPES.QuestionRepo)
    private readonly questionRepository: QuestionRepository,

    @inject(TYPES.CourseRepo)
    private readonly courseRepository: CourseRepository,

    @inject(GLOBAL_TYPES.Database)
    private readonly database: MongoDatabase,
  ) {
    super(database);
  }

  public async create(questionBank: QuestionBank): Promise<string> {
    return this._withTransaction(async session => {
      if (questionBank.courseId) {
        const course = await this.courseRepository.read(
          questionBank.courseId,
          session,
        );
        if (!course) {
          throw new NotFoundError(
            `Course with ID ${questionBank.courseId} not found`,
          );
        }
      }
      if (questionBank.courseVersionId) {
        const courseVersion = await this.courseRepository.readVersion(
          questionBank.courseVersionId,
          session,
        );
        if (!courseVersion) {
          throw new NotFoundError(
            `Course version with ID ${questionBank.courseVersionId} not found`,
          );
        }
      }
      if (questionBank.questions && questionBank.questions.length > 0) {
        const questions = await this.questionRepository.getByIds(
          questionBank.questions as string[],
          session,
        );
        if (questions.length !== questionBank.questions.length) {
          throw new NotFoundError('Some questions not found');
        }
      }
      return await this.questionBankRepository.create(questionBank, session);
    });
  }
  public async getById(questionBankId: string): Promise<IQuestionBank | null> {
    return this._withTransaction(async session => {
      const questionBank = await this.questionBankRepository.getById(
        questionBankId,
        session,
      );
      if (!questionBank) {
        throw new NotFoundError(
          `Question bank with ID ${questionBankId} not found`,
        );
      }
      return questionBank;
    });
  }
  public async delete(questionBankId: string): Promise<boolean> {
    return this._withTransaction(async session => {
      const questionBank = await this.questionBankRepository.getById(
        questionBankId,
        session,
      );
      if (!questionBank) {
        throw new NotFoundError(
          `Question bank with ID ${questionBankId} not found`,
        );
      }
      const result = await this.questionBankRepository.delete(
        questionBankId,
        session,
      );
      return result;
    });
  }
  public async addQuestion(
    questionBankId: string,
    questionId: string,
  ): Promise<IQuestionBank | null> {
    return this._withTransaction(async session => {
      const questionBank = await this.questionBankRepository.getById(
        questionBankId,
        session,
      );
      if (!questionBank) {
        throw new NotFoundError(
          `Question bank with ID ${questionBankId} not found`,
        );
      }
      const question = await this.questionRepository.getById(
        questionId,
        session,
      );
      if (!question) {
        throw new NotFoundError(`Question with ID ${questionId} not found`);
      }
      questionBank.questions.push(questionId);
      return this.questionBankRepository.update(
        questionBankId,
        questionBank,
        session,
      );
    });
  }
  public async removeQuestion(
    questionBankId: string,
    questionId: string,
  ): Promise<IQuestionBank | null> {
    return this._withTransaction(async session => {
      const questionBank = await this.questionBankRepository.getById(
        questionBankId,
        session,
      );
      if (!questionBank) {
        throw new NotFoundError(
          `Question bank with ID ${questionBankId} not found`,
        );
      }
      const questionIndex = questionBank.questions.indexOf(questionId);
      if (questionIndex === -1) {
        throw new NotFoundError(
          `Question with ID ${questionId} not found in question bank`,
        );
      }
      questionBank.questions.splice(questionIndex, 1);
      return this.questionBankRepository.update(
        questionBankId,
        questionBank,
        session,
      );
    });
  }
  public async getQuestions(
    questionBankId: string,
    count: number,
  ): Promise<ID[]> {
    return this._withTransaction(async session => {
      const questionBank = await this.questionBankRepository.getById(
        questionBankId,
        session,
      );
      if (!questionBank) {
        throw new NotFoundError(
          `Question bank with ID ${questionBankId} not found`,
        );
      }
      if (questionBank.questions.length === 0) {
        throw new NotFoundError(
          `No questions found in question bank with ID ${questionBankId}`,
        );
      }
      //Return random question ids
      const shuffledQuestions = questionBank.questions.sort(
        () => 0.5 - Math.random(),
      );
      return shuffledQuestions.slice(0, count);
    });
  }
  public async replaceQuestionWithDuplicate(
    bankId: string,
    questionId: string,
  ): Promise<string> {
    return this._withTransaction(async session => {
      const questionBank = await this.questionBankRepository.getById(
        bankId,
        session,
      );
      if (!questionBank) {
        throw new NotFoundError(`Question bank with ID ${bankId} not found`);
      }

      const originalQuestion = await this.questionRepository.getById(
        questionId,
        session,
      );
      if (!originalQuestion) {
        throw new NotFoundError(
          `Original question with ID ${questionId} not found`,
        );
      }

      const index = questionBank.questions.indexOf(questionId);
      if (index === -1) {
        throw new NotFoundError(
          `Question with ID ${questionId} not found in question bank`,
        );
      }
      const duplicatedQuestion = await this.questionRepository.duplicate(
        questionId,
        session,
      );

      questionBank.questions[index] = duplicatedQuestion._id.toString();
      await this.questionBankRepository.update(bankId, questionBank, session);
      return duplicatedQuestion._id.toString();
    });
  }
  public async getBanksUsingQuestion(questionId): Promise<IQuestionBank[]> {
    throw new Error('Method not implemented.');
  }
  public async getBanksForCourseVersion(
    courseVersionId,
  ): Promise<IQuestionBank[]> {
    throw new Error('Method not implemented.');
  }
}

export {QuestionBankService};
