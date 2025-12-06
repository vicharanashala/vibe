import { IUserQuizMetrics } from '#quizzes/interfaces/grading.js';
import { MongoDatabase } from '#root/shared/database/providers/mongo/MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { injectable, inject } from 'inversify';
import { Collection, ClientSession, ObjectId } from 'mongodb';
import { InternalServerError } from 'routing-controllers';

@injectable()
class UserQuizMetricsRepository {
  private userQuizMetricsCollection: Collection<IUserQuizMetrics>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) { }

  private async init() {
    this.userQuizMetricsCollection =
      await this.db.getCollection<IUserQuizMetrics>('user_quiz_metrics');
  }

  async create(
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

  async get(
    userId: string | ObjectId,
    quizId: string | ObjectId,
    session?: ClientSession,
  ): Promise<IUserQuizMetrics | null> {
    await this.init();
    // normalize IDs to both string and ObjectId
    const userIdStr = userId.toString();
    const userIdObj = ObjectId.isValid(userIdStr)
      ? new ObjectId(userIdStr)
      : null;

    const quizIdStr = quizId.toString();
    const quizIdObj = ObjectId.isValid(quizIdStr)
      ? new ObjectId(quizIdStr)
      : null;

    const filter: any = {
      userId: { $in: [userIdStr, ...(userIdObj ? [userIdObj] : [])] },
      quizId: { $in: [quizIdStr, ...(quizIdObj ? [quizIdObj] : [])] },
    };

    const result = await this.userQuizMetricsCollection.findOne(filter, {
      session,
    });
    if (!result) return null;

    return {
      ...result,
      userId: result.userId?.toString(),
      quizId: result.quizId?.toString(),
      latestAttemptId: result.latestAttemptId?.toString() || null,
      latestSubmissionResultId:
        result.latestSubmissionResultId?.toString() || null,
      attempts: result.attempts.map(attempt => ({
        ...attempt,
        attemptId: attempt.attemptId?.toString(),
        submissionResultId: attempt.submissionResultId?.toString() || null,
      })),
    };
  }

  async executeBulkMetricsReset(
    operations: Array<{ updateOne: { filter: any; update: any } }>,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    if (!operations.length) return;

    await this.userQuizMetricsCollection.bulkWrite(operations, { session });
  }

  async update(
    metricsId: string,
    updateData: Partial<IUserQuizMetrics>,
    session?: ClientSession,
  ): Promise<IUserQuizMetrics> {
    await this.init();

    const result = await this.userQuizMetricsCollection.findOneAndUpdate(
      { _id: new ObjectId(metricsId) },
      { $set: updateData },
      { returnDocument: 'after', session },
    );

    return result;
  }

  async getByQuizId(
    quizId: string,
    session?: ClientSession,
  ): Promise<IUserQuizMetrics[]> {
    await this.init();

    const quizIdStr = quizId.toString();
    const quizIdObj = new ObjectId(quizIdStr);

    const result = await this.userQuizMetricsCollection
      .find(
        {
          quizId: { $in: [quizIdStr, quizIdObj] },
        },
        { session },
      )
      .toArray();

    return result.map(doc => ({
      ...doc,
      _id: doc._id?.toString(),
      userId: doc.userId?.toString(),
      quizId: doc.quizId?.toString(),
      latestAttemptId: doc.latestAttemptId?.toString() || null,
      latestSubmissionResultId:
        doc.latestSubmissionResultId?.toString() || null,
    }));
  }

  async getByQuizIds(
    quizIds: (string | ObjectId)[],
    session?: ClientSession,
  ): Promise<IUserQuizMetrics[]> {
    await this.init();

    const objectIds = quizIds
      .filter(id => typeof id === 'string' && ObjectId.isValid(id) || id instanceof ObjectId)
      .map(id => (typeof id === 'string' ? new ObjectId(id) : id));

    const stringIds = quizIds.map(id => id.toString());

    const result = await this.userQuizMetricsCollection
      .find(
        {
          quizId: { $in: [...stringIds, ...objectIds] },
        },
        { session },
      )
      .toArray();

    return result.map(doc => ({
      ...doc,
      _id: doc._id?.toString(),
      userId: doc.userId?.toString(),
      quizId: doc.quizId?.toString(),
      latestAttemptId: doc.latestAttemptId?.toString() || null,
      latestSubmissionResultId: doc.latestSubmissionResultId?.toString() || null,
    }));
  }


  async getAll(session?: ClientSession): Promise<IUserQuizMetrics[]> {
    await this.init();
    const result = await this.userQuizMetricsCollection
      .find({}, { session })
      .toArray();

    return result.map(doc => ({
      ...doc,
      _id: doc._id?.toString(),
      userId: doc.userId?.toString(),
      quizId: doc.quizId?.toString(),
      latestAttemptId: doc.latestAttemptId?.toString() || null,
      latestSubmissionResultId:
        doc.latestSubmissionResultId?.toString() || null,
    }));
  }


  async findWithMissingSubmissionIds(session?: ClientSession) {
    await this.init();
    try {

      const pipeline = [
        { $unwind: '$attempts' },
        {
          $match: {
            $or: [
              { 'attempts.submissionResultId': { $exists: false } },
              { 'attempts.submissionResultId': null }
            ]
          }
        },
        {
          $group: {
            _id: '$_id',
            userId: { $first: '$userId' },
            quizId: { $first: '$quizId' },
            attempts: { $push: '$attempts' }
          }
        }
      ];
      return this.userQuizMetricsCollection.aggregate(pipeline, { session })


    } catch (error) {
      throw new InternalServerError(
        'Failed to find user quiz metrics with missing submission IDs.\n More Details: ' + error,
      );
    }
  }

  async bulkUpdateMetrics(
    operations: any[],
    session?: ClientSession
  ): Promise<void> {
    await this.init();
    try {
      const result = await this.userQuizMetricsCollection.bulkWrite(operations, {
        session,
      });
      console.log(`UserQuizMetrics bulk update result: ${JSON.stringify(result)}`);
    } catch (error) {
      throw new InternalServerError(
        'Failed to bulk update user quiz metrics.\n More Details: ' + error,
      );
    }
  }
}

export { UserQuizMetricsRepository };
