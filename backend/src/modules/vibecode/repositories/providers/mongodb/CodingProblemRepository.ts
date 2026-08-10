import { GLOBAL_TYPES } from '#root/types.js';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { injectable, inject } from 'inversify';
import { Collection, ObjectId } from 'mongodb';
import { CodingProblem } from '../../../interfaces/CodingProblem.js';

@injectable()
export class CodingProblemRepository {
  private collection: Collection<CodingProblem>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    if (!this.collection) {
      this.collection = await this.db.getCollection<CodingProblem>('coding_problems');
    }
  }

  async getAll(): Promise<CodingProblem[]> {
    await this.init();
    return this.collection.find().toArray();
  }

  async getById(id: string): Promise<CodingProblem | null> {
    await this.init();
    return this.collection.findOne({ _id: new ObjectId(id) });
  }

  async create(problem: CodingProblem): Promise<CodingProblem> {
    await this.init();
    const result = await this.collection.insertOne({
      ...problem,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return { ...problem, _id: result.insertedId };
  }

  async update(id: string, problemUpdate: Partial<CodingProblem>): Promise<boolean> {
    await this.init();
    const result = await this.collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...problemUpdate, updatedAt: new Date() } }
    );
    return result.modifiedCount > 0;
  }

  async delete(id: string): Promise<boolean> {
    await this.init();
    const result = await this.collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }
}
