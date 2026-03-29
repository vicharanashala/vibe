import 'reflect-metadata';
import {injectable, inject} from 'inversify';
import {ClientSession, Collection, ObjectId} from 'mongodb';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {IAchievement, IUserAchievement} from '#root/shared/interfaces/models.js';
import {
  IAchievementRepository,
  IUserAchievementWithDetails,
} from '../interfaces/IAchievementRepository.js';

@injectable()
export class AchievementRepository implements IAchievementRepository {
  private achievementsCollection: Collection<IAchievement>;
  private userAchievementsCollection: Collection<IUserAchievement>;

  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

  private async init(): Promise<void> {
    this.achievementsCollection =
      await this.db.getCollection<IAchievement>('achievements');
    this.userAchievementsCollection =
      await this.db.getCollection<IUserAchievement>('user_achievements');

    // Unique slug index — definitions never duplicate
    await this.achievementsCollection.createIndex({slug: 1}, {unique: true});

    // Composite unique index — one award per (user, achievement)
    await this.userAchievementsCollection.createIndex(
      {userId: 1, achievementId: 1},
      {unique: true},
    );
    await this.userAchievementsCollection.createIndex({userId: 1, earnedAt: -1});
  }

  // ── Definitions ────────────────────────────────────────────────────────────

  async findAll(): Promise<IAchievement[]> {
    await this.init();
    return this.achievementsCollection
      .find({})
      .sort({requiredCourseCount: 1})
      .toArray();
  }

  async findBySlug(slug: string): Promise<IAchievement | null> {
    await this.init();
    return this.achievementsCollection.findOne({slug});
  }

  async seedDefinitions(
    definitions: Omit<IAchievement, '_id'>[],
  ): Promise<void> {
    await this.init();
    if (!definitions.length) return;

    const ops = definitions.map(def => ({
      updateOne: {
        filter: {slug: def.slug},
        update: {$setOnInsert: def},
        upsert: true,
      },
    }));

    await this.achievementsCollection.bulkWrite(ops, {ordered: false});
  }

  // ── User Achievements ──────────────────────────────────────────────────────

  async createUserAchievement(
    record: Omit<IUserAchievement, '_id'>,
    session?: ClientSession,
  ): Promise<string> {
    await this.init();
    const result = await this.userAchievementsCollection.insertOne(
      record as IUserAchievement,
      {session},
    );
    return result.insertedId.toString();
  }

  async findUserAchievements(
    userId: string,
  ): Promise<IUserAchievementWithDetails[]> {
    await this.init();
    const pipeline = [
      {$match: {userId: new ObjectId(userId)}},
      {
        $lookup: {
          from: 'achievements',
          localField: 'achievementId',
          foreignField: '_id',
          as: 'achievement',
        },
      },
      {$unwind: '$achievement'},
      {$sort: {earnedAt: -1}},
    ];
    return this.userAchievementsCollection
      .aggregate<IUserAchievementWithDetails>(pipeline)
      .toArray();
  }

  async findEarnedSlugs(userId: string): Promise<string[]> {
    await this.init();
    const pipeline = [
      {$match: {userId: new ObjectId(userId)}},
      {
        $lookup: {
          from: 'achievements',
          localField: 'achievementId',
          foreignField: '_id',
          as: 'achievement',
        },
      },
      {$unwind: '$achievement'},
      {$project: {slug: '$achievement.slug', _id: 0}},
    ];
    const docs = await this.userAchievementsCollection
      .aggregate<{slug: string}>(pipeline)
      .toArray();
    return docs.map(d => d.slug);
  }

  // ── Progress Query ─────────────────────────────────────────────────────────

  async countCompletedCourses(userId: string): Promise<number> {
    await this.init();
    const progressCollection =
      await this.db.getCollection<{userId: ObjectId; completed: boolean}>(
        'progress',
      );
    return progressCollection.countDocuments({
      userId: new ObjectId(userId),
      completed: true,
    });
  }
}
