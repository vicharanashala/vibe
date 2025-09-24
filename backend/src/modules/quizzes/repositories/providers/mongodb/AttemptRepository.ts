import {IAttempt} from '#quizzes/interfaces/grading.js';
import {MongoDatabase} from '#shared/database/providers/mongo/MongoDatabase.js';
import {injectable, inject} from 'inversify';
import {Collection, ClientSession, ObjectId} from 'mongodb';
import {InternalServerError} from 'routing-controllers';
import {GLOBAL_TYPES} from '#root/types.js';
@injectable()
class AttemptRepository {
  private attemptCollection: Collection<IAttempt>;
  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this.attemptCollection = await this.db.getCollection<IAttempt>(
      'quiz_attempts',
    );
  }

  async create(attempt: IAttempt, session?: ClientSession) {
    await this.init();
    const result = await this.attemptCollection.insertOne(attempt, {session});
    if (result.acknowledged && result.insertedId) {
      return result.insertedId.toString();
    }
    throw new InternalServerError('Failed to create quiz attempt');
  }
  async getById(
    attemptId: string,
    quizId: string,
    session: ClientSession,
  ): Promise<IAttempt | null> {
    await this.init();

    const quizIdStr = quizId.toString();
    const quizIdObj = new ObjectId(quizIdStr);

    const result = await this.attemptCollection.findOne(
      {
        _id: new ObjectId(attemptId),
        quizId: {$in: [quizIdStr, quizIdObj]},
      },
      {session},
    );
    if (!result) {
      return null;
    }
    return {
      ...result,
      userId: result.userId?.toString(),
      quizId: result.quizId?.toString(),
      answers:
        result.answers?.map((ans: any) => ({
          ...ans,
          questionId: ans.questionId?.toString(),
        })) ?? [],
    };
  }
  async countAttempts(
    quizId: string,
    session?: ClientSession,
  ): Promise<number | null> {
    await this.init();

    const quizIdStr = quizId.toString();
    const quizIdObj = new ObjectId(quizIdStr);

    const result = await this.attemptCollection.countDocuments(
      {quizId: {$in: [quizIdStr, quizIdObj]}},
      {session},
    );
    if (!result) {
      return null;
    }
    return result;
  }

  async countUserAttempts(
    quizId: string,
    userId: string,
    session?: ClientSession,
  ): Promise<number | null> {
    await this.init();

    const quizIdStr = quizId.toString();
    const quizIdObj = new ObjectId(quizIdStr);

    const userIdStr = userId.toString();
    const userIdObj = new ObjectId(userIdStr);

    const result = await this.attemptCollection.countDocuments(
      {
        quizId: {$in: [quizIdStr, quizIdObj]},
        userId: {$in: [userIdStr, userIdObj]},
      },
      {session},
    );

    if (!result) {
      return null;
    }
    return result;
  }

  async update(attemptId: string, updateData: Partial<IAttempt>) {
    await this.init();
    const result = await this.attemptCollection.findOneAndUpdate(
      {_id: new ObjectId(attemptId)},
      {$set: updateData},
      {returnDocument: 'after'},
    );
    return result;
  }

  async countByQuestionId(
    questionId: string,
    session?: ClientSession,
  ): Promise<number> {
    await this.init();
    const filter = {
      'questionDetails.questionId': {
        $in: [questionId, new ObjectId(questionId)],
      },
    } as any;
    const count = await this.attemptCollection.countDocuments(filter, {
      session,
    });
    return count;
  }

  async countDistinctUsersByQuestionId(
    questionId: string,
    session?: ClientSession,
  ): Promise<number> {
    await this.init();
    const filter = {
      'questionDetails.questionId': {
        $in: [questionId, new ObjectId(questionId)],
      },
    } as any;
    const distinctUsers = await this.attemptCollection.distinct(
      'userId',
      filter,
      {session},
    );
    return distinctUsers.length;
  }
}

export {AttemptRepository};
