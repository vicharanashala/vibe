import {QuizItem} from '#courses/index.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {MongoDatabase} from '#shared/index.js';
import {injectable, inject} from 'inversify';
import {Collection, ClientSession} from 'mongodb';

@injectable()
class QuizRepository {
  private quizCollection: Collection<QuizItem>;

  constructor(
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
