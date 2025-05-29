import {QuizItem} from 'modules';
import {
  IAttempt,
  ISubmission,
  IUserQuizMetrics,
} from 'modules/quizzes/interfaces/grading';
import {Collection, ClientSession} from 'mongodb';
import {InternalServerError} from 'routing-controllers';
import {Service, Inject} from 'typedi';
import {MongoDatabase} from '../MongoDatabase';

@Service()
class QuizRepository {
  private quizCollection: Collection<QuizItem>;
  private attemptCollection: Collection<IAttempt>;
  private submissionResultCollection: Collection<ISubmission>;
  private userQuizMetricsCollection: Collection<IUserQuizMetrics>;

  constructor(
    @Inject(() => MongoDatabase)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this.quizCollection = await this.db.getCollection<QuizItem>('quizzes');
    this.attemptCollection =
      await this.db.getCollection<IAttempt>('quiz_attempts');
    this.submissionResultCollection = await this.db.getCollection<ISubmission>(
      'quiz_submission_results',
    );
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

  public async createSubmissionResult(
    submission: ISubmission,
  ): Promise<string> {
    await this.init();
    const result = await this.submissionResultCollection.insertOne(submission);
    if (result.acknowledged && result.insertedId) {
      return result.insertedId.toString();
    }
    throw new InternalServerError('Failed to create submission result');
  }
  public async readSubmissionResult(
    quizId: string,
    userId: string,
    attemptId: string,
  ): Promise<ISubmission> {
    await this.init();
    const result = await this.submissionResultCollection.findOne({
      quizId,
      userId,
      attemptId,
    });
    if (!result) {
      return null;
    }
    return result;
  }
  public async updateSubmissionResult(
    submissionId: string,
    updateData: Partial<ISubmission>,
  ): Promise<ISubmission> {
    await this.init();
    const result = await this.submissionResultCollection.findOneAndUpdate(
      {_id: submissionId},
      {$set: updateData},
      {returnDocument: 'after'},
    );
    return result;
  }

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

export {QuizRepository};
