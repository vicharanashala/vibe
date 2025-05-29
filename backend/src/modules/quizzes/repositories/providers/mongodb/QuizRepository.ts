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

@Service()
class QuizRepository {
  private quizCollection: Collection<QuizItem>;

  constructor(
    @Inject(() => MongoDatabase)
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
}

export {QuizRepository};
