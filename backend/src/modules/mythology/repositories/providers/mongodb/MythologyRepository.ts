import { Collection, ObjectId } from 'mongodb';
import { inject, injectable } from 'inversify';
import { MongoDatabase } from '#root/shared/index.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { LeaderboardEntry } from '#mythology/types.js';

/**
 * MongoDB repository for persisting mythology leaderboard entries.
 * Collection: mythology_leaderboard
 */
@injectable()
export class MythologyRepository {
  private collection!: Collection<LeaderboardEntry>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init(): Promise<void> {
    if (!this.collection) {
      this.collection = await this.db.getCollection<LeaderboardEntry>('mythology_leaderboard');
      // Ensure index on name for fast upserts
      await this.collection.createIndex({ name: 1 }, { unique: true });
      await this.collection.createIndex({ streak: -1, karma: -1 });
    }
  }

  /**
   * Upserts a leaderboard entry by student name.
   * Uses MongoDB upsert to avoid duplicates.
   */
  async upsertEntry(entry: Omit<LeaderboardEntry, 'id'>): Promise<void> {
    await this.init();
    await this.collection.updateOne(
      { name: entry.name },
      {
        $set: {
          avatar: entry.avatar,
          department: entry.department,
          track: entry.track,
          lastActive: entry.lastActive,
        },
        $max: {
          streak: entry.streak,
          karma: entry.karma,
        },
        $setOnInsert: {
          _id: new ObjectId(),
        },
      },
      { upsert: true },
    );
  }

  /**
   * Returns the top N leaderboard entries sorted by streak desc, karma desc.
   */
  async getTopEntries(limit = 50): Promise<LeaderboardEntry[]> {
    await this.init();
    const docs = await this.collection
      .find({})
      .sort({ streak: -1, karma: -1 })
      .limit(limit)
      .toArray();

    return docs.map((doc) => ({
      id: doc._id?.toString() ?? doc.name,
      name: doc.name,
      avatar: doc.avatar,
      streak: doc.streak,
      karma: doc.karma,
      department: doc.department,
      track: doc.track,
      lastActive: doc.lastActive,
    }));
  }
}
