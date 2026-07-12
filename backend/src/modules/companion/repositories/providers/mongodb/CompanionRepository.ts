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
  /**
   * Timestamp of when the student last entered a lesson.
   * TTL index auto-removes it after 5 minutes so a crash/unmount
   * doesn't leave the companion stuck in studying mode.
   */
  studyingAt?: Date;
  /**
   * Progress value from the last /companion/me response.
   * Used to detect when a new enrollment has dropped the average
   * by ≥20 points, triggering a "new journey" message.
   */
  lastKnownProgress?: number;
  /**
   * Flag set true when realProgress drops ≥20 points vs lastKnownProgress.
   * Frontend shows the message once, then this flag is cleared.
   */
  newJourney?: boolean;
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
    // 5-minute TTL on studyingAt: ensures the live signal auto-expires if the
    // frontend fails to send studying=false (e.g. tab crash, network drop).
    await this.collection.createIndex(
      {studyingAt: 1},
      {expireAfterSeconds: 300, sparse: true, background: true},
    );
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
      // studyingAt intentionally omitted — new companions are not studying
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

  /** Read the current studyingAt timestamp for a user — returns null if not set */
  async getStudyingAt(userId: string): Promise<Date | null> {
    await this.init();
    const doc = await this.collection!.findOne(
      {userId},
      {projection: {studyingAt: 1}},
    );
    return doc?.studyingAt ?? null;
  }

  /**
   * Set or clear the studying live signal.
   *
   * studying = true  → $set studyingAt to now (TTL index removes it after 5 min)
   * studying = false → $unset studyingAt (clears it immediately)
   *
   * Uses $unset rather than $set null so the TTL index's sparse option
   * doesn't interfere — unset leaves the field absent rather than present-but-null.
   */
  async setStudyingAt(userId: string, studying: boolean): Promise<void> {
    await this.init();
    const update = studying
      ? {$set: {studyingAt: new Date()}}
      : {$unset: {studyingAt: true as const}};
    await this.collection!.updateOne({userId}, update);
  }

  /**
   * Update lastKnownProgress and newJourney flag after each getCompanionState call.
   * Called at the end of every /companion/me response so the next call
   * has the previous state to compare against.
   *
   * If realProgress dropped ≥20 vs the stored lastKnownProgress, set newJourney=true.
   * Otherwise clear newJourney (so it only fires once per drop event).
   *
   * Uses $set directly — does NOT use $setOnInsert because the companion
   * doc always exists by the time this is called (getCompanionState requires it).
   */
  async updateProgressMeta(userId: string, realProgress: number): Promise<boolean> {
    await this.init();
    const doc = await this.collection!.findOne({userId}, {projection: {lastKnownProgress: 1}});
    const prev = doc?.lastKnownProgress ?? null;
    // Detect ≥15-point drop (new enrollment pulling the average down)
    const isNewJourney = prev !== null && prev >= 20 && realProgress <= prev - 15;
    await this.collection!.updateOne(
      {userId},
      {$set: {lastKnownProgress: realProgress, newJourney: isNewJourney}},
    );
    return isNewJourney;
  }

  /** Clear the newJourney flag after frontend has shown the message */
  async clearNewJourney(userId: string): Promise<void> {
    await this.init();
    await this.collection!.updateOne({userId}, {$set: {newJourney: false}});
  }
}

export {CompanionRepository};