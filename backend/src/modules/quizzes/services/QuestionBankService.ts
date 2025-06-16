import {QuestionBank} from '#quizzes/classes/transformers/QuestionBank.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {injectable, inject} from 'inversify';
import {NotFoundError} from 'routing-controllers';
import {QUIZZES_TYPES} from '../types.js';
import {COURSES_TYPES} from '#courses/types.js';
import {BaseService} from '#root/shared/classes/BaseService.js';
import {QuestionBankRepository} from '../repositories/providers/mongodb/QuestionBankRepository.js';
import {QuestionRepository} from '../repositories/providers/mongodb/QuestionRepository.js';
import {CourseRepository} from '#root/shared/database/providers/mongo/repositories/CourseRepository.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {IQuestionBank} from '#root/shared/interfaces/quiz.js';
import {IQuestionBankRef} from '#root/shared/interfaces/models.js';

@injectable()
class QuestionBankService extends BaseService {
  constructor(
    @inject(QUIZZES_TYPES.QuestionBankRepo)
    private readonly questionBankRepository: QuestionBankRepository,

    @inject(QUIZZES_TYPES.QuestionRepo)
    private readonly questionRepository: QuestionRepository,

    @inject(GLOBAL_TYPES.CourseRepo)
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

  //Assumes IQuestionBankRef is valid and do not require validation
  public async getQuestions(
    questionBankRef: IQuestionBankRef,
  ): Promise<string[]> {
    return this._withTransaction(async session => {
      const {
        bankId: questionBankId,
        count,
        difficulty,
        tags,
        type,
      } = questionBankRef;
      const questionBank = await this.questionBankRepository.getById(
        questionBankId,
        session,
      );
      //Return random question ids
      const shuffledQuestions = questionBank.questions.sort(
        () => 0.5 - Math.random(),
      );
      //convert to string if they are ObjectIds
      const shuffledQuestionsAsString = shuffledQuestions.map(q =>
        q.toString(),
      );
      return shuffledQuestionsAsString.slice(0, count);
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
