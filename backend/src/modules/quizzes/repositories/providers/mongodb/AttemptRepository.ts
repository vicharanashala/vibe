import {inject, injectable} from 'inversify';
import {QuizItem} from '#root/modules/courses/index.js';
import {
  IAttempt,
  ISubmission,
  IUserQuizMetrics,
} from '#root/modules/quizzes/interfaces/grading.js';
import {Collection, ClientSession} from 'mongodb';
import {InternalServerError} from 'routing-controllers';
import {MongoDatabase} from '#root/shared/database/providers/index.js';
import {Service, Inject} from 'typedi';
import TYPES from '../../../../../types.js';

@Service()
@injectable()
class AttemptRepository {
  private attemptCollection: Collection<IAttempt>;
  constructor(
    @inject(TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this.attemptCollection =
      await this.db.getCollection<IAttempt>('quiz_attempts');
  }

  public async create(attempt: IAttempt, session?: ClientSession) {
    await this.init();
    const result = await this.attemptCollection.insertOne(attempt, {session});
    if (result.acknowledged && result.insertedId) {
      return result.insertedId.toString();
    }
    throw new InternalServerError('Failed to create quiz attempt');
  }
  public async getById(attemptId: string): Promise<IAttempt | null> {
    await this.init();
    const result = await this.attemptCollection.findOne({_id: attemptId});
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
      {quizId: quizId},
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
      {_id: attemptId},
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
}

export {AttemptRepository};
