import {inject, injectable} from 'inversify';
import {BaseQuestion} from '#root/modules/quizzes/classes/transformers/index.js';
import {ClientSession, Collection} from 'mongodb';
import {InternalServerError} from 'routing-controllers';
import {Service, Inject} from 'typedi';
import TYPES from '../../../../../types.js';
import {MongoDatabase} from '#root/shared/database/providers/index.js';

@Service()
@injectable()
class QuestionRepository {
  private questionCollection: Collection<BaseQuestion>;

  constructor(
    @Inject(() => MongoDatabase)
    @inject(TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this.questionCollection =
      await this.db.getCollection<BaseQuestion>('questions');
  }

  public async create(
    question: BaseQuestion,
    session?: ClientSession,
  ): Promise<string | null> {
    await this.init();
    const result = await this.questionCollection.insertOne(question);
    if (result.acknowledged && result.insertedId) {
      return result.insertedId.toString();
    }
  }
  public async getById(
    questionId: string,
    session?: ClientSession,
  ): Promise<BaseQuestion | null> {
    await this.init();
    const result = await this.questionCollection.findOne(
      {_id: questionId},
      {session},
    );
    if (!result) {
      return null;
    }
    return result;
  }
  public async getByIds(
    questionIds: string[],
    session?: ClientSession,
  ): Promise<BaseQuestion[]> {
    await this.init();
    const results = await this.questionCollection
      .find({_id: {$in: questionIds}}, {session})
      .toArray();
    return results;
  }
  public async update(
    questionId: string,
    updateData: Partial<BaseQuestion>,
    session?: ClientSession,
  ): Promise<BaseQuestion | null> {
    await this.init();
    const result = await this.questionCollection.findOneAndUpdate(
      {_id: questionId},
      {$set: updateData},
      {returnDocument: 'after', session},
    );
    if (!result) {
      return null;
    }
    return result;
  }
  public async delete(
    questionId: string,
    session?: ClientSession,
  ): Promise<boolean> {
    await this.init();
    const result = await this.questionCollection.deleteOne(
      {_id: questionId},
      {session},
    );
    return result.deletedCount === 1;
  }
  public async duplicate(
    questionId: string,
    session?: ClientSession,
  ): Promise<BaseQuestion | null> {
    await this.init();
    const question = await this.getById(questionId, session);
    const newQuestion = {...question, _id: undefined}; // Create a copy without the _id
    const result = await this.questionCollection.insertOne(newQuestion, {
      session,
    });
    if (result.acknowledged && result.insertedId) {
      return {...newQuestion, _id: result.insertedId.toString()};
    }
    throw new InternalServerError('Failed to duplicate question');
  }
}

export {QuestionRepository};
