import {inject, injectable} from 'inversify';
import {IUserQuizMetrics} from 'modules/quizzes/interfaces/grading';
import {Collection, ClientSession, ObjectId} from 'mongodb';
import {InternalServerError} from 'routing-controllers';
import {MongoDatabase} from 'shared/database/providers/MongoDatabaseProvider';
import TYPES from '../../../../../types';

@injectable()
class UserQuizMetricsRepository {
  private userQuizMetricsCollection: Collection<IUserQuizMetrics>;

  constructor(
    @inject(TYPES.Database)
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
  public async udpate(
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

export {UserQuizMetricsRepository};
