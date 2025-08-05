import { IProgress, IWatchTime } from '#shared/interfaces/models.js';
import { injectable, inject } from 'inversify';
import { Collection, ObjectId, ClientSession } from 'mongodb';
import { MongoDatabase } from '../MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';

type CurrentProgress = Pick<
  IProgress,
  'currentModule' | 'currentSection' | 'currentItem' | 'completed'
>;

@injectable()
class ProgressRepository {
  private progressCollection!: Collection<IProgress>;
  private watchTimeCollection!: Collection<IWatchTime>;

  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) { }

  private async init() {
    this.progressCollection =
      await this.db.getCollection<IProgress>('progress');
    this.watchTimeCollection =
      await this.db.getCollection<IWatchTime>('watchTime');
  }

  async getCompletedItems(userId: string, courseId: string, courseVersionId: string, session?: ClientSession): Promise<String[]> {
    await this.init();
    const userProgress = await this.watchTimeCollection.find({
      userId: new ObjectId(userId),
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(courseVersionId),
    }, {session}).project({ itemId: 1, _id: 0 }).toArray();
    return userProgress.map(item => item.itemId.toString()) as String[];
  }

  async getAllWatchTime(userId: string, session?: ClientSession): Promise<IWatchTime[]> {
    await this.init();
    const result = await this.watchTimeCollection.find(
      { userId: new ObjectId(userId) },
      { session },
    ).toArray();
    return result.map((item) => ({
      ...item,
      _id: item._id.toString(),
      userId: item.userId.toString(),
      courseId: item.courseId.toString(),
      courseVersionId: item.courseVersionId.toString(),
      itemId: item.itemId.toString(),
    }));
  }

  async deleteWatchTimeByItemId(itemId: string, session?: ClientSession): Promise<void> {
    await this.init();
    await this.watchTimeCollection.deleteMany(
      { itemId: new ObjectId(itemId) },
      { session },
    );
  }

  async deleteWatchTimeByCourseId(courseId: string, session?: ClientSession): Promise<void> {
    await this.init();
    const result = await this.watchTimeCollection.deleteMany(
      { courseId: new ObjectId(courseId) },
      { session },
    );
    if (result.deletedCount === 0) {
      throw new Error(`No watch time records found for course ID: ${courseId}`);
    }
  }

  async deleteWatchTimeByVersionId(courseVersionId: string, session?: ClientSession): Promise<void> {
    await this.init();
    const result = await this.watchTimeCollection.deleteMany(
      { courseVersionId: new ObjectId(courseVersionId) },
      { session },
    );
    if (result.deletedCount === 0) {
      throw new Error(`No watch time records found for version ID: ${courseVersionId}`);
    }
  }

  async deleteUserWatchTimeByCourseId(userId:string,courseId: string, session?: ClientSession): Promise<void> {
    await this.init();
    const result = await this.watchTimeCollection.deleteMany(
      { userId: new ObjectId(userId), courseId: new ObjectId(courseId) },
      { session },
    );
    if (result.deletedCount === 0) {
      throw new Error(`No watch time records found for user ID: ${userId} and course ID: ${courseId}`);
    }
  }

  async findProgress(
    userId: string | ObjectId,
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<IProgress | null> {
    await this.init();
    return await this.progressCollection.findOne(
      {
        userId: new ObjectId(userId),
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
      },
      {
        session,
      },
    );
  }

  async findById(
    id: string,
    session: ClientSession,
  ): Promise<IProgress | null> {
    await this.init();
    return await this.progressCollection.findOne(
      { _id: new ObjectId(id) },
      {
        session,
      },
    );
  }

  async updateProgress(
    userId: string | ObjectId,
    courseId: string,
    courseVersionId: string,
    progress: Partial<CurrentProgress>,
    session?: ClientSession,
  ): Promise<IProgress | null> {
    await this.init();
    const result = await this.progressCollection.findOneAndUpdate(
      {
        userId: new ObjectId(userId),
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
      },
      { $set: progress },
      { returnDocument: 'after', session },
    );
    return result;
  }

  async createProgress(
    progress: IProgress,
    session: ClientSession,
  ): Promise<IProgress> {
    await this.init();
    const result = await this.progressCollection.insertOne(progress, { session });
    const newProgress = await this.progressCollection.findOne(
      {
        _id: result.insertedId,
      },
      {
        session,
      },
    );
    return newProgress;
  }

  async startItemTracking(
    userId: string | ObjectId,
    courseId: string,
    courseVersionId: string,
    itemId: string,
    session?: ClientSession,
  ): Promise<string | null> {
    await this.init();
    const watchTime: IWatchTime = {
      userId: new ObjectId(userId),
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(courseVersionId),
      itemId: new ObjectId(itemId),
      startTime: new Date(),
    };
    const result = await this.watchTimeCollection.insertOne(watchTime, {
      session,
    });
    if (result.acknowledged === false) {
      return null;
    }
    return result.insertedId.toString();
  }
  async stopItemTracking(
    userId: string | ObjectId,
    courseId: string,
    courseVersionId: string,
    itemId: string,
    watchTimeId: string,
    session?: ClientSession,
  ): Promise<IWatchTime | null> {
    await this.init();
    const result = await this.watchTimeCollection.findOneAndUpdate(
      {
        _id: new ObjectId(watchTimeId),
        userId: new ObjectId(userId),
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
        itemId: new ObjectId(itemId),
      },
      { $set: { endTime: new Date() } },
      { returnDocument: 'after', session },
    );
    return result;
  }

  async getWatchTime(
    userId: string | ObjectId,
    itemId: string,
    courseId?: string,
    courseVersionId?: string,
    session?: ClientSession,
  ): Promise<IWatchTime[] | null> {
    await this.init();
    
    // Build query dynamically and add logging
    const query: any = {
      userId: new ObjectId(userId),
      itemId: new ObjectId(itemId),
    };
    
    // Add optional courseId and courseVersionId if provided
    if (courseId) {
      query.courseId = new ObjectId(courseId);
    }
    if (courseVersionId) {
      query.courseVersionId = new ObjectId(courseVersionId);
    }
    const result = await this.watchTimeCollection.find(query, { session }).toArray();
    return result.map((item) => ({
      ...item,
      _id: item._id.toString(),
      userId: item.userId.toString(),
      courseId: item.courseId.toString(),
      courseVersionId: item.courseVersionId.toString(),
      itemId: item.itemId.toString(),
    }));
  }

  async getWatchTimeById(
    id: string,
    session?: ClientSession,
  ): Promise<IWatchTime | null> {
    await this.init();
    const result = await this.watchTimeCollection.findOne(
      {
        _id: new ObjectId(id),
      },
      {
        session,
      },
    );
    return result;
  }

  async findAndReplaceProgress(
    userId: string | ObjectId,
    courseId: string,
    courseVersionId: string,
    progress: Partial<IProgress>,
    session?: ClientSession,
  ): Promise<IProgress | null> {
    await this.init();
    const result = await this.progressCollection.findOneAndUpdate(
      {
        userId: new ObjectId(userId),
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
      },
      { $set: progress },
      { returnDocument: 'after', session },
    );
    return result;
  }
}

export { ProgressRepository };
