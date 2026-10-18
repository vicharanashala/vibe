import 'reflect-metadata';
import {inject, injectable} from 'inversify';
import {ClientSession, Collection, ObjectId} from 'mongodb';
import {GLOBAL_TYPES} from '#root/types.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {IDiscussionReply} from '../../model.js';
import {IDiscussionReplyRepository} from '../../../interfaces/IDiscussionReplyRepository.js';

@injectable()
export class DiscussionReplyRepository implements IDiscussionReplyRepository {
  private _replies!: Collection<IDiscussionReply>;

  constructor(
    @inject(GLOBAL_TYPES.Database) private readonly _db: MongoDatabase,
  ) {}

  private async init(): Promise<void> {
    if (!this._replies) {
      this._replies = await this._db.getCollection<IDiscussionReply>(
        'discussion_replies',
      );
      // Speeds up the per-thread chronological read used on every
      // GET /discussions/:threadId call.
      await this._replies.createIndex({threadId: 1, createdAt: 1});
    }
  }

  async listByThread(
    threadId: string,
    session?: ClientSession,
  ): Promise<IDiscussionReply[]> {
    await this.init();

    if (!ObjectId.isValid(threadId)) {
      return [];
    }

    return this._replies
      .find({threadId: new ObjectId(threadId)}, {session})
      .sort({createdAt: 1})
      .toArray();
  }

  async findById(
    replyId: string,
    session?: ClientSession,
  ): Promise<IDiscussionReply | null> {
    await this.init();

    if (!ObjectId.isValid(replyId)) {
      return null;
    }

    return this._replies.findOne(
      {_id: new ObjectId(replyId)},
      {session},
    );
  }

  async create(
    reply: IDiscussionReply,
    session?: ClientSession,
  ): Promise<IDiscussionReply> {
    await this.init();

    const now = new Date();
    const toInsert: IDiscussionReply = {
      ...reply,
      createdAt: now,
      updatedAt: now,
    };

    const result = await this._replies.insertOne(
      toInsert as any,
      {session},
    );
    return {...toInsert, _id: result.insertedId};
  }

  async deleteById(
    replyId: string,
    session?: ClientSession,
  ): Promise<boolean> {
    await this.init();

    if (!ObjectId.isValid(replyId)) {
      return false;
    }

    const result = await this._replies.deleteOne(
      {_id: new ObjectId(replyId)},
      {session},
    );
    return result.deletedCount === 1;
  }

  async deleteByThread(
    threadId: string,
    session?: ClientSession,
  ): Promise<number> {
    await this.init();

    if (!ObjectId.isValid(threadId)) {
      return 0;
    }

    const result = await this._replies.deleteMany(
      {threadId: new ObjectId(threadId)},
      {session},
    );
    return result.deletedCount ?? 0;
  }
}