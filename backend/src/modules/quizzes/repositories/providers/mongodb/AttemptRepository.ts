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

  public async create(attempt: IAttempt, session?: ClientSession) {
    await this.init();
    const result = await this.attemptCollection.insertOne(attempt, {session});
    if (result.acknowledged && result.insertedId) {
      return result.insertedId.toString();
    }
    throw new InternalServerError('Failed to create quiz attempt');
  }
  public async getById(
    attemptId: string,
    quizId: string,
    session: ClientSession,
  ): Promise<IAttempt | null> {
    await this.init();
    const result = await this.attemptCollection.findOne(
      {
        _id: new ObjectId(attemptId),
        quizId: quizId,
      },
      {session},
    );
    if (!result) {
      return null;
    }
    return result;
  }
  public async countAttempts(
    quizId: string,
    session?: ClientSession,
  ): Promise<number | null> {
    await this.init();
    const result = await this.attemptCollection.countDocuments(
      {quizId: new ObjectId(quizId)},
      {session},
    );
    if (!result) {
      return null;
    }
    return result;
  }
  public async update(attemptId: string, updateData: Partial<IAttempt>) {
    await this.init();
    const result = await this.attemptCollection.findOneAndUpdate(
      {_id: new ObjectId(attemptId)},
      {$set: updateData},
      {returnDocument: 'after'},
    );
    return result;
  }
  public async getByQuizId(
    quizId: string,
    session?: ClientSession,
  ): Promise<IAttempt[]> {
    await this.init();
    const result = await this.attemptCollection
      .find({quizId: quizId}, {session})
      .toArray();
    return result;
  }

  public async countByQuestionId(
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



  public async countDistinctUsersByQuestionId(
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
