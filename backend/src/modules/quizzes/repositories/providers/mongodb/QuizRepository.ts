import {inject, injectable} from 'inversify';
import {QuizItem} from 'modules/courses';
import {
  IAttempt,
  ISubmission,
  IUserQuizMetrics,
} from 'modules/quizzes/interfaces/grading';
import {Collection, ClientSession} from 'mongodb';
import {InternalServerError} from 'routing-controllers';
import {MongoDatabase} from 'shared/database/providers/MongoDatabaseProvider';
import {Service, Inject} from 'typedi';
import TYPES from '../../../../../types';

@Service()
@injectable()
class QuizRepository {
  private quizCollection: Collection<QuizItem>;

  constructor(
    @Inject(() => MongoDatabase)
    @inject(TYPES.Database)
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
