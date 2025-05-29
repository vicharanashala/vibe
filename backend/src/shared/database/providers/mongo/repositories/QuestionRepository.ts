import {BaseQuestion} from 'modules/quizzes/classes/transformers';
import {Collection} from 'mongodb';
import {InternalServerError} from 'routing-controllers';
import {Service, Inject} from 'typedi';
import {MongoDatabase} from '../MongoDatabase';

@Service()
class QuestionRepository {
  private questionCollection: Collection<BaseQuestion>;

  constructor(
    @Inject(() => MongoDatabase)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this.questionCollection =
      await this.db.getCollection<BaseQuestion>('questions');
  }

  public async createQuestion(question: BaseQuestion) {
    await this.init();
    const result = await this.questionCollection.insertOne(question);
    if (result.acknowledged && result.insertedId) {
      return result.insertedId.toString();
    }
    throw new InternalServerError('Failed to create question');
  }

  public async getQuestionById(
    questionId: string,
  ): Promise<BaseQuestion | null> {
    await this.init();
    const result = await this.questionCollection.findOne({_id: questionId});
    if (!result) {
      return null;
    }
    return result;
  }
}

export {QuestionRepository};
