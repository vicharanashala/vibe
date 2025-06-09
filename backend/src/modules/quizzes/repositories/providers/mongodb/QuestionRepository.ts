import {BaseQuestion} from '#quizzes/classes/index.js';
import {MongoDatabase} from '#shared/index.js';
import {injectable, inject} from 'inversify';
import {Collection, ClientSession, ObjectId} from 'mongodb';
import {InternalServerError} from 'routing-controllers';
import {GLOBAL_TYPES} from '#root/types.js';
import {plainToInstance} from 'class-transformer';
@injectable()
class QuestionRepository {
  private questionCollection: Collection<BaseQuestion>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
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
      {_id: new ObjectId(questionId)},
      {session},
    );
    return result;
  }
  public async getByIds(
    questionIds: string[],
    session?: ClientSession,
  ): Promise<BaseQuestion[]> {
    await this.init();
    const objectIds = questionIds.map(id => new ObjectId(id));
    const results = await this.questionCollection
      .find({_id: {$in: objectIds}}, {session})
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
      {_id: new ObjectId(questionId)},
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
      {_id: new ObjectId(questionId)},
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
