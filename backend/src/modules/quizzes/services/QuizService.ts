import {QuizItem} from 'modules/courses';
import {ClientSession, Collection} from 'mongodb';
import {MongoDatabase} from 'shared/database/providers/MongoDatabaseProvider';
import {Service, Inject} from 'typedi';
import {
  IAttempt,
  IAttemptDetails,
  IQuestionAnswer,
  ISubmissionResult,
  IUserQuizMetrics,
} from '../interfaces/grading';
import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from 'routing-controllers';

class Attempt implements IAttempt {
  _id?: string;
  quizId: string;
  userId: string;
  questionIds: string[];
  answers?: IQuestionAnswer[];
  createdAt: Date;
  updatedAt: Date;

  constructor(quizId: string, userId: string) {
    this.quizId = quizId;
    this.userId = userId;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}

class UserQuizMetrics implements IUserQuizMetrics {
  userId: string;
  quizId: string;
  remainingAttempts: number;
  latestAttemptId?: string;
  latestAttemptStatus: 'ATTEMPTED' | 'SUBMITTED';
  attempts: IAttemptDetails[];

  constructor(userId: string, quizId: string, maxAttempts: number) {
    this.userId = userId;
    this.quizId = quizId;
    this.remainingAttempts = maxAttempts;
    this.latestAttemptStatus = 'ATTEMPTED';
    this.attempts = [];
  }
}

@Service()
class QuizRepository {
  private quizCollection: Collection<QuizItem>;
  private attemptCollection: Collection<IAttempt>;
  private submissionResultCollection: Collection<ISubmissionResult>;
  private userQuizMetricsCollection: Collection<IUserQuizMetrics>;

  constructor(
    @Inject(() => MongoDatabase)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this.quizCollection = await this.db.getCollection<QuizItem>('quizzes');
    this.attemptCollection =
      await this.db.getCollection<IAttempt>('quiz_attempts');
    this.submissionResultCollection =
      await this.db.getCollection<ISubmissionResult>('quiz_submission_results');
    this.userQuizMetricsCollection =
      await this.db.getCollection<IUserQuizMetrics>('user_quiz_metrics');
  }

  public async createAttempt(attempt: IAttempt, session?: ClientSession) {
    await this.init();
    const result = await this.attemptCollection.insertOne(attempt, {session});
    if (result.acknowledged && result.insertedId) {
      return result.insertedId.toString();
    }
    throw new InternalServerError('Failed to create quiz attempt');
  }
  public async getAttemptById(attemptId: string): Promise<IAttempt | null> {
    await this.init();
    const result = await this.attemptCollection.findOne({_id: attemptId});
    if (!result) {
      return null;
    }
    return result;
  }
  public async updateAttempt(attemptId: string, updateData: Partial<IAttempt>) {
    await this.init();
    const result = await this.attemptCollection.findOneAndUpdate(
      {_id: attemptId},
      {$set: updateData},
      {returnDocument: 'after'},
    );
    return result;
  }

  //   public async createSubmissionResult(submission: ISubmissionResult): Promise<ISubmissionResult> {}
  //   public async readSubmissionResultById(submissionId: string): Promise<ISubmissionResult> {}
  //   public async updateSubmissionResult(
  //         submissionId: string,
  //         updateData: Partial<ISubmissionResult>,
  //     ): Promise<ISubmissionResult> {}

  //CRUD for Quiz COllection
  public async getQuizById(
    quizId: string,
    session?: ClientSession,
  ): Promise<QuizItem | null> {
    await this.init();
    const result = await this.quizCollection.findOne({_id: quizId}, {session});
    if (!result) {
      return null;
    }
    return result;
  }

  public async createUserQuizMetrics(
    metrics: IUserQuizMetrics,
    session?: ClientSession,
  ): Promise<string | null> {
    await this.init();
    const result = await this.userQuizMetricsCollection.insertOne(metrics, {
      session,
    });
    if (result.acknowledged && result.insertedId) {
      return result.insertedId.toString();
    }
    throw new InternalServerError('Failed to create user quiz metrics');
  }
  public async getUserQuizMetrics(
    userId: string,
    quizId: string,
    session?: ClientSession,
  ): Promise<IUserQuizMetrics | null> {
    await this.init();
    const result = await this.userQuizMetricsCollection.findOne(
      {userId, quizId},
      {session},
    );
    if (!result) {
      return null;
    }
    return result;
  }
  // public async readUserQuizMetricsById(metricsId: string): Promise<IUserQuizMetrics> {}
  public async updateUserQuizMetrics(
    metricsId: string,
    updateData: Partial<IUserQuizMetrics>,
  ): Promise<IUserQuizMetrics> {
    await this.init();
    const result = await this.userQuizMetricsCollection.findOneAndUpdate(
      {_id: metricsId},
      {$set: updateData},
      {returnDocument: 'after'},
    );

    return result;
  }
}

@Service()
class QuizService {
  constructor(
    @Inject(() => QuizRepository)
    private quizRepository: QuizRepository,
  ) {}

  public async attempt(userId: string, quizId: string): Promise<string> {
    //1. Check if UserQuizMetrics exists for the user and quiz
    let metrics = await this.quizRepository.getUserQuizMetrics(userId, quizId);
    const quiz = await this.quizRepository.getQuizById(quizId);
    if (!metrics) {
      //1a If not, create a new UserQuizMetrics
      if (!quiz) {
        throw new NotFoundError(`Quiz with ID ${quizId} not found`);
      }

      const newMetrics: UserQuizMetrics = new UserQuizMetrics(
        userId,
        quizId,
        quiz.details.maxAttempts,
      );
      //1b Create new UserQuizMetrics
      const createdMetricsId =
        await this.quizRepository.createUserQuizMetrics(newMetrics);

      metrics = await this.quizRepository.getUserQuizMetrics(userId, quizId);
    }

    //2. Check if the quiz is of type 'DEADLINE' and if the deadline has passed
    if (
      quiz.details.quizType === 'DEADLINE' &&
      quiz.details.deadline < new Date()
    ) {
      throw new BadRequestError('Quiz deadline has passed');
    }

    //3. Check if available attempts > 0
    if (metrics.remainingAttempts <= 0 || metrics.remainingAttempts !== -1) {
      throw new BadRequestError('No available attempts left for this quiz');
    }

    //4. Create a new attempt
    const newAttempt = new Attempt(quizId, userId);
    const attemptId = await this.quizRepository.createAttempt(newAttempt);

    //5. Update UserQuizMetrics with the new attempt
    metrics.latestAttemptStatus = 'ATTEMPTED';
    metrics.latestAttemptId = attemptId;
    metrics.remainingAttempts--;
    metrics.attempts.push({attemptId});
    await this.quizRepository.updateUserQuizMetrics(
      metrics._id.toString(),
      metrics,
    );

    //6. Return the attempt ID
    return attemptId;
  }
  public async submit(
    userId: string,
    quizId: string,
    attemptId: string,
    answers: IQuestionAnswer[],
  ): Promise<void> {
    await this.save(userId, quizId, attemptId, answers);
  }
  public async save(
    userId: string,
    quizId: string,
    attemptId: string,
    answers: IQuestionAnswer[],
  ): Promise<void> {
    //1. Fetch the attempt by ID
    const attempt = await this.quizRepository.getAttemptById(attemptId);
    if (!attempt) {
      throw new NotFoundError(`Attempt with ID ${attemptId} not found`);
    }
    //2. Check if the attempt belongs to the user and quiz
    if (attempt.userId !== userId || attempt.quizId !== quizId) {
      throw new BadRequestError('Attempt does not belong to the user or quiz');
    }
    //3. Update the attempt with the answers
    attempt.answers = answers;
    attempt.updatedAt = new Date();

    //4. Save the updated attempt
    await this.quizRepository.updateAttempt(attemptId, attempt);
  }
  private async grade(): Promise<void> {}

  private async getQuestionsForAttempt(quizId: string): Promise<void> {}
}
