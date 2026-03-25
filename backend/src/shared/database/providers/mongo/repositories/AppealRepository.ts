import 'reflect-metadata';
import {injectable, inject} from 'inversify';
import {Collection, ObjectId, ClientSession} from 'mongodb';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {IAppeal} from '#root/shared/database/interfaces/IAppeal.js';

@injectable()
export class AppealRepository {
  private collection!: Collection<IAppeal>;

  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

  private async init() {
    if (!this.collection) {
      this.collection = await this.db.getCollection<IAppeal>('appeals');
    }
  }

  async create(appeal: IAppeal, session?: ClientSession): Promise<string> {
    await this.init();
    const res = await this.collection.insertOne(appeal, {session});
    return res.insertedId.toString();
  }

  async findById(id: string): Promise<IAppeal | null> {
    await this.init();
    return this.collection.findOne({_id: new ObjectId(id)});
  }

  async findPending(
    userId: string,
    courseId: string,
    versionId: string,
    cohortId: string,
  ): Promise<IAppeal | null> {
    await this.init();
    return this.collection.findOne({
      userId: new ObjectId(userId),
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(versionId),
      cohortId: new ObjectId(cohortId),
      status: 'PENDING',
    });
  }

  async existsPending(
    userId: string,
    courseId: string,
    versionId: string,
    cohortId: string,
  ): Promise<boolean> {
    const existing = await this.findPending(
      userId,
      courseId,
      versionId,
      cohortId,
    );
    return !!existing;
  }

  // async findAll(filters: any): Promise<IAppeal[]> {
  //   await this.init();
  //   return this.collection.find(filters).sort({createdAt: -1}).toArray();
  // }
  async findAll(filters: any): Promise<IAppeal[]> {
    await this.init();
    const query: any = {};

    if (filters.courseId) query.courseId = new ObjectId(filters.courseId);
    if (filters.courseVersionId)
      query.courseVersionId = new ObjectId(filters.courseVersionId);
    if (filters.cohortId) query.cohortId = new ObjectId(filters.cohortId);
    if (filters.status) query.status = filters.status;
    if (filters.userId) query.userId = new ObjectId(filters.userId);

    return this.collection.find(query).sort({createdAt: -1}).toArray();
  }

  async update(
    id: string,
    updates: Partial<IAppeal>,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    await this.collection.updateOne(
      {_id: new ObjectId(id)},
      {$set: {...updates, updatedAt: new Date()}},
      {session},
    );
  }
}
