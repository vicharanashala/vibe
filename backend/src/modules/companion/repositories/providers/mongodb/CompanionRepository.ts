import {Companion} from '#companion/classes/Companion.js';
import {CompanionAnimal} from '#companion/classes/interfaces.js';
import {MongoDatabase} from '#shared/database/providers/mongo/MongoDatabase.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {injectable, inject} from 'inversify';
import {Collection, ObjectId} from 'mongodb';
import {InternalServerError} from 'routing-controllers';

interface CompanionDoc {
  _id?: ObjectId;
  userId: string;
  animal: CompanionAnimal;
  lastActiveAt: Date;
  createdAt: Date;
}

@injectable()
class CompanionRepository {
  private collection: Collection<CompanionDoc> | null = null;
  private initialized = false;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    if (this.initialized) return;
    this.collection = await this.db.getCollection<CompanionDoc>('companions');
    await this.collection.createIndex({userId: 1}, {unique: true, background: true});
    this.initialized = true;
  }

  /** Create a new companion — called when student picks their animal */
  async create(params: {
    userId: string;
    animal: CompanionAnimal;
    now?: Date;
  }): Promise<Companion> {
    await this.init();
    const now = params.now ?? new Date();
    const doc: CompanionDoc = {
      userId: params.userId,
      animal: params.animal,
      lastActiveAt: now,
      createdAt: now,
    };
    const result = await this.collection!.insertOne(doc as any);
    if (!result.acknowledged || !result.insertedId) {
      throw new InternalServerError('Failed to create companion');
    }
    return new Companion(params.userId, params.animal, now, now);
  }

  /** Get companion by userId — returns null if student hasn't picked one yet */
  async getByUserId(userId: string): Promise<Companion | null> {
    await this.init();
    const doc = await this.collection!.findOne({userId});
    if (!doc) return null;
    return new Companion(doc.userId, doc.animal, doc.lastActiveAt, doc.createdAt);
  }

  /**
   * Upsert the animal choice.
   * - If no companion exists for the user: create one.
   * - If one exists: update the animal choice (and bump lastActiveAt).
   *
   * NOTE: deliberately does NOT reset createdAt on update — that timestamp
   * represents the user's first pick and powers the "time with companion"
   * surface elsewhere.
   */
  async upsert(userId: string, animal: CompanionAnimal): Promise<Companion> {
    await this.init();
    const now = new Date();
    const existing = await this.getByUserId(userId);
    if (!existing) {
      return this.create({userId, animal, now});
    }
    const result = await this.collection!.findOneAndUpdate(
      {userId},
      {$set: {animal, lastActiveAt: now}},
      {returnDocument: 'after'},
    );
    if (!result) {
      // Doc vanished between read and write (race) — fall back to create.
      return this.create({userId, animal, now});
    }
    return new Companion(
      result.userId,
      result.animal,
      result.lastActiveAt,
      result.createdAt,
    );
  }
}

export {CompanionRepository};