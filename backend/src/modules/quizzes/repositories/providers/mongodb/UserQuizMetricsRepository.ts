import {IUserQuizMetrics} from '#quizzes/interfaces/grading.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {injectable, inject} from 'inversify';
import {Collection, ClientSession, ObjectId} from 'mongodb';
import {InternalServerError} from 'routing-controllers';

@injectable()
class UserQuizMetricsRepository {
  private userQuizMetricsCollection: Collection<IUserQuizMetrics>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this.userQuizMetricsCollection =
      await this.db.getCollection<IUserQuizMetrics>('user_quiz_metrics');
  }

  public async create(
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
  public async get(
    userId: string | ObjectId,
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
  public async update(
    metricsId: string,
    updateData: Partial<IUserQuizMetrics>,
    session?: ClientSession,
  ): Promise<IUserQuizMetrics> {
    await this.init();

    const result = await this.userQuizMetricsCollection.findOneAndUpdate(
      {_id: new ObjectId(metricsId)},
      {$set: updateData},
      {returnDocument: 'after', session},
    );

    return result;
  }

  async resetUserMetrics(
    userId: string,
    quizId: string,
    maxAttempts: number,
    session?: ClientSession,
  ) {
    try {
      await this.init();

      if (!quizId) {
        throw new InternalServerError(
          'Failed to remove attempts from quiz metrics / More quizId or attemptId is missing',
        );
      }
      // Step 1: Find the doc to get actual remove count
      const metricsDoc = await this.userQuizMetricsCollection.findOne(
        {quizId, userId},
        {session},
      );

      console.log("User metrics: ", metricsDoc)

      // Step 2: Reset the quiz metrics fields
      await this.userQuizMetricsCollection.updateOne(
        {quizId, userId},
        {
          $set: {
            attempts: [],
            latestAttemptId: null,
            latestSubmissionResultId: null,
            latestAttemptStatus: null,
            skipCount: 0,
            remainingAttempts: maxAttempts,
          },
        },
        {session},
      );

    } catch (error) {
      throw new InternalServerError(
        `Failed to remove attempts from metrics /More ${error}`,
      );
    }
  }
}

export {UserQuizMetricsRepository};
