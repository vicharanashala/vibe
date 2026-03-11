import {QuestionBank} from '#quizzes/classes/transformers/QuestionBank.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {injectable, inject} from 'inversify';
import {NotFoundError} from 'routing-controllers';
import {QUIZZES_TYPES} from '../types.js';
import {COURSES_TYPES} from '#courses/types.js';
import {BaseService} from '#root/shared/classes/BaseService.js';
import {QuestionBankRepository} from '../repositories/providers/mongodb/QuestionBankRepository.js';
import {QuestionRepository} from '../repositories/providers/mongodb/QuestionRepository.js';
import {ICourseRepository} from '#root/shared/database/interfaces/ICourseRepository.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {IQuestionBank} from '#root/shared/interfaces/quiz.js';
import {IQuestionBankRef} from '#root/shared/interfaces/models.js';
import {ClientSession, ObjectId} from 'mongodb';

@injectable()
class QuestionBankService extends BaseService {
  constructor(
    @inject(QUIZZES_TYPES.QuestionBankRepo)
    private readonly questionBankRepository: QuestionBankRepository,

    @inject(QUIZZES_TYPES.QuestionRepo)
    private readonly questionRepository: QuestionRepository,

    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepository: ICourseRepository,

    @inject(GLOBAL_TYPES.Database)
    private readonly database: MongoDatabase,
  ) {
    super(database);
  }

  async create(questionBank: QuestionBank): Promise<string> {
    return this._withTransaction(async session => {
      if (questionBank.courseId) {
        const course = await this.courseRepository.read(
          questionBank.courseId.toString(),
          session,
        );
        if (!course) {
          throw new NotFoundError(
            `Course with ID ${questionBank.courseId.toString()} not found`,
          );
        }
      }
      if (questionBank.courseVersionId) {
        const courseVersion = await this.courseRepository.readVersion(
          questionBank.courseVersionId.toString(),
          session,
        );
        if (!courseVersion) {
          throw new NotFoundError(
            `Course version with ID ${questionBank.courseVersionId.toString()} not found`,
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
  async getById(questionBankId: string): Promise<IQuestionBank | null> {
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
      questionBank._id = questionBank._id.toString();

      return questionBank;
    });
  }
  async delete(
    questionBankId: string,
    session?: ClientSession,
  ): Promise<boolean> {
    const run = async (txnSession?: ClientSession) => {
      const questionBank = await this.questionBankRepository.getById(
        questionBankId,
        txnSession,
      );
      if (!questionBank) {
        throw new NotFoundError(
          `Question bank with ID ${questionBankId} not found`,
        );
      }

      const result = await this.questionBankRepository.delete(
        questionBankId,
        txnSession,
      );
      return result;
    };

    return session ? run(session) : this._withTransaction(run);
  }
  async addQuestion(
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
      const questionObjectId = new ObjectId(questionId);
      questionBank.questions.push(questionObjectId);
      questionBank.courseVersionId = new ObjectId(questionBank.courseVersionId);
      questionBank.courseId = new ObjectId(questionBank.courseId.toString());

      return this.questionBankRepository.update(
        questionBankId,
        questionBank,
        session,
      );
    });
  }
  async removeQuestion(
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
      /*
      Maintain the reference to perform a soft delete in question repository
      questionBank.questions.splice(questionIndex, 1);
      questionBank.courseVersionId = new ObjectId(questionBank.courseVersionId);
      questionBank.courseId = new ObjectId(questionBank.courseId.toString());

      const updatedQuestionBank = await this.questionBankRepository.update(
        questionBankId,
        questionBank,
        session,
      );*/

      // soft delete question from questionRepository.

      const deleteResult = await this.questionRepository.delete(
        questionId,
        session,
      );

      return questionBank;
    });
  }

  //Assumes IQuestionBankRef is valid and do not require validation
  async getQuestions(questionBankRef: IQuestionBankRef): Promise<string[]> {
    return this._withTransaction(async session => {
      const {
        bankId: questionBankId,
        count,
        difficulty,
        tags,
        type,
      } = questionBankRef;
      const questionBank = await this.questionBankRepository.getById(
        questionBankId.toString(),
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
  async replaceQuestionWithDuplicate(
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
      // Push the duplicated question into the question bank.
      questionBank.questions.push(duplicatedQuestion._id.toString());
      questionBank.courseVersionId = new ObjectId(questionBank.courseVersionId);
      questionBank.courseId = new ObjectId(questionBank.courseId.toString());
      await this.questionBankRepository.update(bankId, questionBank, session);
      return duplicatedQuestion._id.toString();
    });
  }
  async getBanksUsingQuestion(questionId): Promise<IQuestionBank[]> {
    throw new Error('Method not implemented.');
  }
  async getBanksForCourseVersion(courseVersionId): Promise<IQuestionBank[]> {
    throw new Error('Method not implemented.');
  }
}

export {QuestionBankService};
