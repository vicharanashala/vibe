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
    const result = await this.collection!.insertOne(doc);
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
   * Upsert the animal choice atomically.
   * - If no companion exists for the user: create one (createdAt = now).
   * - If one exists: update the animal choice and bump lastActiveAt,
   *   preserving the original createdAt.
   *
   * Uses a single atomic findOneAndUpdate with $set + $setOnInsert instead of
   * a read-then-write pattern. This avoids a race where two concurrent
   * selectAnimal calls could both fall through to the create() fallback and
   * clobber the original createdAt timestamp.
   */
  async upsert(userId: string, animal: CompanionAnimal): Promise<Companion> {
    await this.init();
    const now = new Date();
    const result = await this.collection!.findOneAndUpdate(
      {userId},
      {
        $set: {animal, lastActiveAt: now},
        $setOnInsert: {userId, createdAt: now},
      },
      {upsert: true, returnDocument: 'after'},
    );
    if (!result) {
      throw new InternalServerError('Failed to upsert companion');
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