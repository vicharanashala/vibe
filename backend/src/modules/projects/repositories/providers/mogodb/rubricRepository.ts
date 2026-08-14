import {IRubricRepository} from '#root/modules/projects/interfaces/IRubricRepository.js';
import {ClientSession, Collection, ObjectId} from 'mongodb';
import {IRubric} from '../../model.js';
import {inject, injectable} from 'inversify';
import {GLOBAL_TYPES} from '#root/types.js';
import {ID, MongoDatabase} from '#root/shared/index.js';

@injectable()
export class RubricRepository implements IRubricRepository {
  private _rubricCollection: Collection<IRubric>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this._rubricCollection =
      await this.db.getCollection<IRubric>('project_rubrics');
  }

  async create(
    rubric: Omit<IRubric, '_id' | 'createdAt' | 'updatedAt'>,
    session?: ClientSession,
  ): Promise<ID> {
    await this.init();
    const result = await this._rubricCollection.insertOne(
      {
        ...rubric,
        createdAt: new Date(),
      },
      {session},
    );
    return result.insertedId;
  }

  async getById(
    rubricId: string,
    session?: ClientSession,
  ): Promise<IRubric | null> {
    if (!ObjectId.isValid(rubricId)) return null;
    await this.init();
    return await this._rubricCollection.findOne(
      {_id: new ObjectId(rubricId)},
      {session},
    );
  }

  async getByCourseVersion(
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<IRubric[]> {
    if (!ObjectId.isValid(courseId) || !ObjectId.isValid(courseVersionId)) {
      return [];
    }
    await this.init();
    return await this._rubricCollection
      .find(
        {
          courseId: new ObjectId(courseId),
          courseVersionId: new ObjectId(courseVersionId),
        },
        {session},
      )
      .sort({createdAt: 1})
      .toArray();
  }

  async getAll(session?: ClientSession): Promise<IRubric[]> {
    await this.init();
    return await this._rubricCollection
      .find({}, {session})
      .sort({createdAt: -1})
      .toArray();
  }

  async update(
    rubricId: string,
    patch: Pick<Partial<IRubric>, 'title' | 'description' | 'criteria'>,
    session?: ClientSession,
  ): Promise<IRubric | null> {
    if (!ObjectId.isValid(rubricId)) return null;
    await this.init();
    const result = await this._rubricCollection.findOneAndUpdate(
      {_id: new ObjectId(rubricId)},
      {$set: {...patch, updatedAt: new Date()}},
      {session, returnDocument: 'after'},
    );
    return result || null;
  }

  async delete(rubricId: string, session?: ClientSession): Promise<boolean> {
    if (!ObjectId.isValid(rubricId)) return false;
    await this.init();
    const result = await this._rubricCollection.deleteOne(
      {_id: new ObjectId(rubricId)},
      {session},
    );
    return result.deletedCount === 1;
  }
}
