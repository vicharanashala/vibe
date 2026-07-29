import {QuestionBank} from '#quizzes/classes/transformers/QuestionBank.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {injectable, inject} from 'inversify';
import {ForbiddenError, NotFoundError} from 'routing-controllers';
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
        const versionStatus =
          await this.courseRepository.getCourseVersionStatus(
            questionBank.courseVersionId.toString(),
          );
        if (versionStatus === 'archived') {
          throw new ForbiddenError(
            'Course version is archived. You can not create question bank',
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
      const questionBankId = await this.questionBankRepository.create(questionBank, session);
      
      // If points is set, cascade to all questions in the bank
      const pointsToUse = questionBank.points !== undefined ? questionBank.points : 5;
      if (pointsToUse !== undefined && questionBank.questions && questionBank.questions.length > 0) {
        await this.questionBankRepository.updateQuestionsPoints(
          questionBankId,
          pointsToUse,
          session,
        );
      }
      
      return questionBankId;
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
      const versionStatus = await this.courseRepository.getCourseVersionStatus(
        questionBank.courseVersionId.toString(),
      );
      if (versionStatus === 'archived') {
        throw new ForbiddenError(
          'Course version is archived. You can not delete question bank',
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
      const versionStatus = await this.courseRepository.getCourseVersionStatus(
        questionBank.courseVersionId.toString(),
      );
      if (versionStatus === 'archived') {
        throw new ForbiddenError(
          'Course version is archived. You can not add questions',
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

      // If question bank has points set, update the new question's points
      if (questionBank.points !== undefined) {
        await this.questionRepository.updatePoints(questionId, questionBank.points, session);
      }

      return this.questionBankRepository.update(
        questionBankId,
        questionBank,
        session,
      );
    });
  }

  /**
   * Find (or lazily create) the crowd "Submitted – Pending Validation" bank
   * for a quiz's graded bank. Crowd-sourced student questions are parked here
   * instead of the graded bank until peer-validated + instructor-approved, so
   * they never enter graded quiz draws. The bank is NOT added to the quiz's
   * questionBankRefs. See studentQuestions/CROWD_QUESTION_BANK.md.
   */
  async findOrCreateCrowdSubmittedBank(
    gradedBankId: string,
    sourceQuizId?: string | ObjectId,
  ): Promise<string> {
    const existing =
      await this.questionBankRepository.findCrowdSubmittedBankByGradedBankId(
        gradedBankId,
      );
    if (existing?._id) {
      return existing._id.toString();
    }

    const gradedBank = await this.questionBankRepository.getById(gradedBankId);
    if (!gradedBank) {
      throw new NotFoundError(
        `Graded question bank with ID ${gradedBankId} not found`,
      );
    }

    const now = new Date();
    const doc: IQuestionBank = {
      courseId: gradedBank.courseId
        ? new ObjectId(gradedBank.courseId.toString())
        : undefined,
      courseVersionId: gradedBank.courseVersionId
        ? new ObjectId(gradedBank.courseVersionId.toString())
        : undefined,
      title: 'Submitted – Pending Validation: ' + (gradedBank.title || 'Quiz'),
      description:
        'Crowd-sourced student questions awaiting peer validation + instructor approval. Not part of the graded quiz.',
      questions: [],
      tags: ['CROWD_SUBMITTED'],
      crowdSubmitted: true,
      sourceGradedBankId: new ObjectId(gradedBankId),
      sourceQuizId: sourceQuizId ? new ObjectId(sourceQuizId.toString()) : undefined,
      createdAt: now,
      updatedAt: now,
    };
    return this.questionBankRepository.create(doc);
  }

  /**
   * Instructor-approval step of the crowd pipeline: move a peer-validated,
   * instructor-approved crowd question OUT of its "Submitted – Pending
   * Validation" bank and INTO the quiz's graded bank, so it counts toward
   * grading. Idempotent and best-effort. Adds to graded BEFORE removing from
   * submitted, so an interruption leaves the question in both (recoverable),
   * never neither. Returns the graded bank id it was moved into, or null if
   * the question is not in any crowd-submitted bank (e.g. already moved).
   */
  async promoteSubmittedQuestionToGraded(
    questionId: string,
  ): Promise<string | null> {
    const banks =
      (await this.questionBankRepository.getQuestionBanksByQuestionId(
        questionId,
      )) ?? [];
    const submitted = banks.find(b => (b as IQuestionBank).crowdSubmitted);
    if (!submitted || !submitted._id || !submitted.sourceGradedBankId) {
      return null;
    }
    const gradedBankId = submitted.sourceGradedBankId.toString();
    await this.addQuestion(gradedBankId, questionId);
    await this.removeQuestion(submitted._id.toString(), questionId);
    return gradedBankId;
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
      const versionStatus = await this.courseRepository.getCourseVersionStatus(
        questionBank.courseVersionId.toString(),
      );
      if (versionStatus === 'archived') {
        throw new ForbiddenError(
          'Course version is archived. You can not remove questions',
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
      const versionStatus = await this.courseRepository.getCourseVersionStatus(
        questionBank.courseVersionId.toString(),
      );
      if (versionStatus === 'archived') {
        throw new ForbiddenError(
          'Course version is archived. You can not replace questions',
        );
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
      
      // Set the duplicated question's points to match the question bank's points
      if (questionBank.points !== undefined) {
        await this.questionRepository.updatePoints(
          duplicatedQuestion._id.toString(),
          questionBank.points,
          session,
        );
      }
      
      // Push the duplicated question into the question bank.
      questionBank.questions.push(duplicatedQuestion._id.toString());
      questionBank.courseVersionId = new ObjectId(questionBank.courseVersionId);
      questionBank.courseId = new ObjectId(questionBank.courseId.toString());
      await this.questionBankRepository.update(bankId, questionBank, session);
      return duplicatedQuestion._id.toString();
    });
  }
  async updatePoints(
    questionBankId: string,
    points: number,
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
      const versionStatus = await this.courseRepository.getCourseVersionStatus(
        questionBank.courseVersionId.toString(),
      );
      if (versionStatus === 'archived') {
        throw new ForbiddenError(
          'Course version is archived. You can not update question bank points',
        );
      }
      
      // Update the question bank's points
      questionBank.points = points;
      questionBank.courseVersionId = new ObjectId(questionBank.courseVersionId);
      questionBank.courseId = new ObjectId(questionBank.courseId.toString());
      
      const updatedBank = await this.questionBankRepository.update(
        questionBankId,
        questionBank,
        session,
      );
      
      // Cascade points to all questions in the bank
      if (questionBank.questions && questionBank.questions.length > 0) {
        await this.questionBankRepository.updateQuestionsPoints(
          questionBankId,
          points,
          session,
        );
      }
      
      return updatedBank;
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
