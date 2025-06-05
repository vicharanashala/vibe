import {inject, injectable} from 'inversify';
import {QuizItem} from '#root/modules/courses/index.js';
import {
  IAttempt,
  ISubmission,
  IUserQuizMetrics,
} from '#root/modules/quizzes/interfaces/grading.js';
import {Collection, ClientSession} from 'mongodb';
import {InternalServerError} from 'routing-controllers';
import {MongoDatabase} from '#root/shared/database/providers/MongoDatabaseProvider.js';
import {Service, Inject} from 'typedi';
import GLOBAL_TYPES from '../../../../../types.js';

@Service()
@injectable()
class QuizRepository {
  private quizCollection: Collection<QuizItem>;

  constructor(
    @Inject(() => MongoDatabase)
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this.quizCollection = await this.db.getCollection<QuizItem>('quizzes');
  }

  public async getById(
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

  public async updateQuiz(
    quiz: QuizItem,
    session?: ClientSession,
  ): Promise<QuizItem> {
    await this.init();
    const result = await this.quizCollection.findOneAndUpdate(
      {_id: quiz._id},
      {$set: quiz},
      {returnDocument: 'after', session},
    );
    if (!result) {
      return null;
    }
    return result;
  }
}

export {QuizRepository};
