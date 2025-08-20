import {MongoDatabase} from '#shared/database/providers/mongo/MongoDatabase.js';
import {IQuestionBank} from '#shared/interfaces/quiz.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {injectable, inject} from 'inversify';
import {Collection, ClientSession, ObjectId} from 'mongodb';

@injectable()
class QuestionBankRepository {
  private questionBankCollection: Collection<IQuestionBank>;
  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this.questionBankCollection =
      await this.db.getCollection<IQuestionBank>('questionBanks');
  }

  public async create(
    questionBank: IQuestionBank,
    session?: ClientSession,
  ): Promise<string> {
    await this.init();
    const result = await this.questionBankCollection.insertOne(questionBank, {
      session,
    });
    if (result.acknowledged && result.insertedId) {
      return result.insertedId.toString();
    }
    throw new Error('Failed to create question bank');
  }

  public async getById(
    questionBankId: string,
    session?: ClientSession,
  ): Promise<IQuestionBank | null> {
    await this.init();
    const result = await this.questionBankCollection.findOne(
      {_id: new ObjectId(questionBankId)},
      {session},
    );
    if (!result) {
      return null;
    }
    return result;
  }

  public async removeQuestionFromAllBanks(
    questionId: string,
    session?: ClientSession,
  ): Promise<number> {
    await this.init();

    const result = await this.questionBankCollection.updateMany(
      {questions: new ObjectId(questionId)},
      {$pull: {questions: new ObjectId(questionId)}},
      {session},
    );

    return result.modifiedCount; // number of banks updated
  }

  public async update(
    questionBankId: string,
    updateData: Partial<IQuestionBank>,
    session?: ClientSession,
  ): Promise<IQuestionBank | null> {
    await this.init();
    const result = await this.questionBankCollection.findOneAndUpdate(
      {_id: new ObjectId(questionBankId)},
      {$set: updateData},
      {returnDocument: 'after', session},
    );
    if (!result) {
      return null;
    }
    result._id = result._id.toString(); // Convert ObjectId to string
    return result;
  }

  public async delete(
    questionBankId: string,
    session?: ClientSession,
  ): Promise<boolean> {
    await this.init();
    const result = await this.questionBankCollection.deleteOne(
      {_id: new ObjectId(questionBankId)},
      {session},
    );
    return result.deletedCount === 0;
  }

  public async getQuestionBanksByQuestionId(
    questionId: string,
    session?: ClientSession,
  ): Promise<IQuestionBank[]> {
    await this.init();
    const result = await this.questionBankCollection.find(
      {questions: new ObjectId(questionId)},
      {session},
    ).toArray();
    return result;
  }
}

export {QuestionBankRepository};
