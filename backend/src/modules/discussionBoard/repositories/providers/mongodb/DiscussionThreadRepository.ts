import 'reflect-metadata';
import {inject, injectable} from 'inversify';
import {ClientSession, Collection, ObjectId} from 'mongodb';
import {GLOBAL_TYPES} from '#root/types.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {IDiscussionThread} from '../../model.js';
import {IDiscussionThreadRepository} from '../../../interfaces/IDiscussionThreadRepository.js';

@injectable()
export class DiscussionThreadRepository implements IDiscussionThreadRepository {
  private _threads!: Collection<IDiscussionThread>;

  constructor(
    @inject(GLOBAL_TYPES.Database) private readonly _db: MongoDatabase,
  ) {}

  private async init(): Promise<void> {
    if (!this._threads) {
      this._threads = await this._db.getCollection<IDiscussionThread>(
        'discussion_threads',
      );
      // Speeds up cohort-scoped listings and ensures index parity with the
      // (courseId, cohortId) read pattern the service uses.
      await this._threads.createIndex({courseId: 1, cohortId: 1, createdAt: -1});
      await this._threads.createIndex({courseId: 1, pinned: -1, createdAt: -1});
    }
  }

  async listByCourse(
    courseId: string,
    cohortFilter: Record<string, unknown>,
    session?: ClientSession,
  ): Promise<IDiscussionThread[]> {
    await this.init();

    if (!ObjectId.isValid(courseId)) {
      return [];
    }

    return this._threads
      .find(
        {
          courseId: new ObjectId(courseId),
          ...cohortFilter,
        },
        {session},
      )
      .sort({pinned: -1, createdAt: -1})
      .toArray();
  }

  async findById(
    threadId: string,
    session?: ClientSession,
  ): Promise<IDiscussionThread | null> {
    await this.init();

    if (!ObjectId.isValid(threadId)) {
      return null;
    }

    return this._threads.findOne({_id: new ObjectId(threadId)}, {session});
  }

  async create(
    thread: IDiscussionThread,
    session?: ClientSession,
  ): Promise<IDiscussionThread> {
    await this.init();

    const now = new Date();
    const toInsert: IDiscussionThread = {
      ...thread,
      pinned: thread.pinned ?? false,
      createdAt: now,
      updatedAt: now,
    };

    const result = await this._threads.insertOne(
      toInsert as any,
      {session},
    );
    return {...toInsert, _id: result.insertedId};
  }

  async update(
    threadId: string,
    data: {title?: string; body?: string; pinned?: boolean},
    session?: ClientSession,
  ): Promise<IDiscussionThread | null> {
    await this.init();

    if (!ObjectId.isValid(threadId)) {
      return null;
    }

    const set: Record<string, unknown> = {updatedAt: new Date()};
    if (typeof data.title === 'string') set.title = data.title;
    if (typeof data.body === 'string') set.body = data.body;
    if (typeof data.pinned === 'boolean') set.pinned = data.pinned;

    const result = await this._threads.findOneAndUpdate(
      {_id: new ObjectId(threadId)},
      {$set: set},
      {session, returnDocument: 'after'},
    );

    return result ?? null;
  }

  async deleteById(
    threadId: string,
    session?: ClientSession,
  ): Promise<boolean> {
    await this.init();

    if (!ObjectId.isValid(threadId)) {
      return false;
    }

    const result = await this._threads.deleteOne(
      {_id: new ObjectId(threadId)},
      {session},
    );
    return result.deletedCount === 1;
  }
}