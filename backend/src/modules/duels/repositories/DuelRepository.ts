import { injectable, inject } from 'inversify';
import { Collection, ClientSession, ObjectId } from 'mongodb';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { IDuel, IDuelMatchmakingQueue } from '../types.js';

@injectable()
export class DuelRepository {
  private collection: Collection<IDuel>;
  private matchmakingQueueCollection: Collection<IDuelMatchmakingQueue>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this.collection = await this.db.getCollection<IDuel>('duels');
    // Index on players.userId for history and pending checks
    await this.collection.createIndex({ 'players.userId': 1 });
    // Index on status for active duels query
    await this.collection.createIndex({ status: 1 });
    // Index on inviteToken for quick lookups
    await this.collection.createIndex({ inviteToken: 1 }, { sparse: true });

    // Matchmaking queue collection
    this.matchmakingQueueCollection = await this.db.getCollection<IDuelMatchmakingQueue>('duelMatchmakingQueue');
    await this.matchmakingQueueCollection.createIndex({ userId: 1 });
    await this.matchmakingQueueCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await this.matchmakingQueueCollection.createIndex({ status: 1, courseId: 1, moduleId: 1 });
  }

  async create(duel: IDuel, session?: ClientSession): Promise<string> {
    await this.init();
    const result = await this.collection.insertOne(duel, { session });
    if (result.acknowledged && result.insertedId) {
      return result.insertedId.toString();
    }
    throw new Error('Failed to create duel');
  }

  async getById(id: string | ObjectId, session?: ClientSession): Promise<IDuel | null> {
    await this.init();
    const result = await this.collection.findOne({ _id: new ObjectId(id) }, { session });
    if (!result) return null;
    return {
      ...result,
      _id: result._id.toString(),
    };
  }

  async update(
    id: string | ObjectId,
    updateData: Partial<IDuel>,
    session?: ClientSession,
  ): Promise<IDuel | null> {
    await this.init();
    const updatePayload = { ...updateData };
    delete updatePayload._id;

    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updatePayload },
      { returnDocument: 'after', session },
    );
    if (!result) return null;
    return {
      ...result,
      _id: result._id.toString(),
    };
  }

  async findPendingForUser(userId: string): Promise<IDuel[]> {
    await this.init();
    const results = await this.collection
      .find({
        status: { $in: ['PENDING', 'READY', 'IN_PROGRESS'] },
        'players.userId': userId,
      })
      .toArray();

    return results.map(r => ({
      ...r,
      _id: r._id.toString(),
    }));
  }

  async findHistoryForUser(userId: string, skip: number, limit: number): Promise<IDuel[]> {
    await this.init();
    const results = await this.collection
      .find({
        'players.userId': userId,
        status: { $in: ['COMPLETED', 'CANCELLED', 'EXPIRED'] },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return results.map(r => ({
      ...r,
      _id: r._id.toString(),
    }));
  }

  async countHistoryForUser(userId: string): Promise<number> {
    await this.init();
    return this.collection.countDocuments({
      'players.userId': userId,
      status: { $in: ['COMPLETED', 'CANCELLED', 'EXPIRED'] },
    });
  }

  async findByInviteToken(token: string): Promise<IDuel | null> {
    await this.init();
    const result = await this.collection.findOne({ inviteToken: token });
    if (!result) return null;
    return {
      ...result,
      _id: result._id.toString(),
    };
  }

  async findUnresolvedExpiredScheduledDuels(now: Date): Promise<IDuel[]> {
    await this.init();
    // Grace period ends at scheduledFor + 10 minutes (600 seconds)
    // We want to find duels where scheduledFor + 10 minutes < now
    const cutoffDate = new Date(now.getTime() - 10 * 60 * 1000);
    const results = await this.collection
      .find({
        status: { $in: ['PENDING', 'READY'] },
        matchType: 'FRIEND',
        scheduledFor: { $lt: cutoffDate },
      })
      .toArray();

    return results.map(r => ({
      ...r,
      _id: r._id.toString(),
    }));
  }

  async countDailyWinsBetweenPlayers(
    winnerId: string,
    opponentId: string,
    startOfDay: Date,
  ): Promise<number> {
    await this.init();
    return this.collection.countDocuments({
      status: 'COMPLETED',
      winnerUserId: winnerId,
      pointsAwarded: { $gt: 0 },
      createdAt: { $gte: startOfDay },
      'players.userId': opponentId,
    });
  }

  async countDailyPointsAwardedWinsForUser(
    winnerId: string,
    startOfDay: Date,
  ): Promise<number> {
    await this.init();
    return this.collection.countDocuments({
      status: 'COMPLETED',
      winnerUserId: winnerId,
      pointsAwarded: { $gt: 0 },
      createdAt: { $gte: startOfDay },
    });
  }

  async joinMatchmakingQueue(entry: IDuelMatchmakingQueue): Promise<string> {
    await this.init();
    // Cancel any existing WAITING entries for this user first
    await this.matchmakingQueueCollection.updateMany(
      { userId: entry.userId, status: 'WAITING' },
      { $set: { status: 'CANCELLED' } }
    );
    const result = await this.matchmakingQueueCollection.insertOne(entry);
    if (result.acknowledged && result.insertedId) {
      return result.insertedId.toString();
    }
    throw new Error('Failed to join matchmaking queue');
  }

  async cancelMatchmakingQueue(userId: string): Promise<boolean> {
    await this.init();
    const result = await this.matchmakingQueueCollection.updateMany(
      { userId, status: 'WAITING' },
      { $set: { status: 'CANCELLED' } }
    );
    return result.acknowledged;
  }

  async getMatchmakingQueueStatus(userId: string): Promise<IDuelMatchmakingQueue | null> {
    await this.init();
    const result = await this.matchmakingQueueCollection.findOne(
      { userId, status: { $in: ['WAITING', 'MATCHED'] } },
      { sort: { queuedAt: -1 } }
    );
    if (!result) return null;
    return {
      ...result,
      _id: result._id.toString(),
    };
  }

  async findWaitingMatchmakingEntries(courseId: string, moduleId?: string | null): Promise<IDuelMatchmakingQueue[]> {
    await this.init();
    const query: any = {
      status: 'WAITING',
      courseId,
    };
    if (moduleId !== undefined) {
      query.moduleId = moduleId;
    }
    const results = await this.matchmakingQueueCollection.find(query).toArray();
    return results.map(r => ({
      ...r,
      _id: r._id.toString(),
    }));
  }

  async claimMatch(entryAId: string, entryBId: string, duelId: string): Promise<boolean> {
    await this.init();
    const client = await this.db.getClient();
    const session = client.startSession();
    try {
      let success = false;
      await session.withTransaction(async () => {
        const resA = await this.matchmakingQueueCollection.findOneAndUpdate(
          { _id: new ObjectId(entryAId), status: 'WAITING' },
          { $set: { status: 'MATCHED', matchedDuelId: duelId } },
          { session }
        );
        const resB = await this.matchmakingQueueCollection.findOneAndUpdate(
          { _id: new ObjectId(entryBId), status: 'WAITING' },
          { $set: { status: 'MATCHED', matchedDuelId: duelId } },
          { session }
        );
        if (resA && resB) {
          success = true;
        } else {
          throw new Error('Match claim lock failed: one of the entries is no longer waiting.');
        }
      });
      return success;
    } catch (err) {
      return false;
    } finally {
      await session.endSession();
    }
  }

  async findActiveInProgressDuels(): Promise<IDuel[]> {
    await this.init();
    const results = await this.collection
      .find({
        status: 'IN_PROGRESS',
      })
      .toArray();

    return results.map(r => ({
      ...r,
      _id: r._id.toString(),
    }));
  }
}
