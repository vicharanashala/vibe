import 'reflect-metadata';
import {Collection, ObjectId} from 'mongodb';
import {inject, injectable} from 'inversify';
import {MongoDatabase} from '#shared/database/providers/mongo/MongoDatabase.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {Comment, IComment} from '../../../classes/transformers/Comment.js';

@injectable()
export class CommentRepository {
  private comments!: Collection<IComment>;
  /** Read only to put a name against a comment's author. */
  private users!: Collection<{
    _id: ObjectId;
    firstName?: string;
    lastName?: string;
    email?: string;
  }>;
  private initialized = false;

  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

  private async init(): Promise<void> {
    if (this.initialized) return;
    this.comments = await this.db.getCollection<IComment>('comments');
    this.users = await this.db.getCollection('users');
    this.initialized = true;

    try {
      await this.comments.createIndex({itemId: 1, createdAt: 1}, {background: true});
    } catch {
      // Index already exists.
    }
  }

  async listByItem(itemId: string, limit: number): Promise<IComment[]> {
    await this.init();
    return this.comments
      .find({itemId: new ObjectId(itemId), isDeleted: {$ne: true}})
      .sort({createdAt: 1})
      .limit(limit)
      .toArray();
  }

  async findById(commentId: string): Promise<IComment | null> {
    await this.init();
    return this.comments.findOne({_id: new ObjectId(commentId), isDeleted: {$ne: true}});
  }

  async create(comment: Comment): Promise<string> {
    await this.init();
    const result = await this.comments.insertOne(comment);
    return result.insertedId.toString();
  }

  /** Names for a set of authors, keyed by user id — mirrors ReflectionRepository.findAuthors. */
  async findAuthors(userIds: string[]): Promise<Map<string, string>> {
    await this.init();
    const out = new Map<string, string>();
    if (userIds.length === 0) return out;

    const docs = await this.users
      .find(
        {_id: {$in: [...new Set(userIds)].map(id => new ObjectId(id))}},
        {projection: {firstName: 1, lastName: 1, email: 1}},
      )
      .toArray();

    for (const d of docs) {
      const name = [d.firstName, d.lastName].filter(Boolean).join(' ').trim();
      out.set(d._id.toString(), name || d.email || 'Unknown');
    }
    return out;
  }
}
