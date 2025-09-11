import {
  IAttemptDetails,
  IUserQuizMetrics,
} from '#quizzes/interfaces/grading.js';
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
      userId: {$in: [userIdStr, ...(userIdObj ? [userIdObj] : [])]},
      quizId: {$in: [quizIdStr, ...(quizIdObj ? [quizIdObj] : [])]},
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
    };
  }

  async executeBulkMetricsReset(
    operations: Array<{updateOne: {filter: any; update: any}}>,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    if (!operations.length) return;

    await this.userQuizMetricsCollection.bulkWrite(operations, {session});
  }

  async update(
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
          quizId: {$in: [quizIdStr, quizIdObj]},
        },
        {session},
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

  async getAll(session?: ClientSession): Promise<IUserQuizMetrics[]> {
    await this.init();
    const result = await this.userQuizMetricsCollection
      .find({}, {session})
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

  async bulkConvertIds(): Promise<{updated: number}> {
    try {
      await this.init();

      const metricsDocs = await this.userQuizMetricsCollection
        .find()
        .project({
          _id: 1,
          userId: 1,
          quizId: 1,
          latestAttemptId: 1,
          attempts: 1,
          latestSubmissionResultId: 1
        })
        .toArray();

      if (!metricsDocs.length) return {updated: 0};

      const bulkOperations = metricsDocs
        .map((metric: IUserQuizMetrics) => {
          let needsUpdate = false;

          let updatedUserId = metric.userId;
          if (metric.userId && typeof metric.userId === 'string') {
            updatedUserId = new ObjectId(metric.userId);
            needsUpdate = true;
          }

          let updatedQuizId = metric.quizId;
          if (metric.quizId && typeof metric.quizId === 'string') {
            updatedQuizId = new ObjectId(metric.quizId);
            needsUpdate = true;
          }

          let updatedLatestAttemptId = metric.latestAttemptId;
          if (
            metric.latestAttemptId &&
            typeof metric.latestAttemptId === 'string'
          ) {
            updatedLatestAttemptId = new ObjectId(metric.latestAttemptId);
            needsUpdate = true;
          }

          let updatedLatestSubmissionResultId = metric.latestSubmissionResultId;
          if (
            metric.latestSubmissionResultId &&
            typeof metric.latestSubmissionResultId === 'string'
          ) {
            updatedLatestSubmissionResultId = new ObjectId(
              metric.latestSubmissionResultId,
            );
            needsUpdate = true;
          }

          // Convert IDs inside attempts array
          const updatedAttempts = (metric.attempts || []).map(
            (attempt: IAttemptDetails) => {
              let newAttempt = {...attempt};

              if (attempt?.attemptId && typeof attempt.attemptId === 'string') {
                newAttempt.attemptId = new ObjectId(attempt.attemptId);
                needsUpdate = true;
              }

              if (
                attempt?.submissionResultId &&
                typeof attempt.submissionResultId === 'string'
              ) {
                newAttempt.submissionResultId = new ObjectId(
                  attempt.submissionResultId,
                );
                needsUpdate = true;
              }

              return newAttempt;
            },
          );

          if (needsUpdate) {
            return {
              updateOne: {
                filter: {_id: metric._id},
                update: {
                  $set: {
                    userId: updatedUserId,
                    quizId: updatedQuizId,
                    latestAttemptId: updatedLatestAttemptId,
                    attempts: updatedAttempts,
                    latestSubmissionResultId: updatedLatestSubmissionResultId,
                  },
                },
              },
            };
          }

          return null;
        })
        .filter(Boolean);

      if (!bulkOperations.length) return {updated: 0};

      const result = await this.userQuizMetricsCollection.bulkWrite(
        bulkOperations,
      );
      return {updated: result.modifiedCount};
    } catch (error) {
      throw new InternalServerError(
        `Failed metrics ID conversion. More/ ${error}`,
      );
    }
  }
}

export {UserQuizMetricsRepository};
