import { IUserActivityEvent } from '#shared/interfaces/models.js';
import { injectable, inject } from 'inversify';
import { Collection, ObjectId, ClientSession } from 'mongodb';
import { MongoDatabase } from '../MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { BadRequestError, InternalServerError } from 'routing-controllers';

@injectable()
class UserActivityEventRepository {
  private userActivityEventCollection!: Collection<IUserActivityEvent>;
  private initialized = false;

  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) { }

  private async init() {
    // Initialize only once to prevent catalog change errors
    if (this.initialized) {
      return;
    }

    this.userActivityEventCollection = await this.db.getCollection<IUserActivityEvent>(
      'user_activity_events',
    );

    this.initialized = true;

    // Create indexes with background: true and error handling
    try {
      await this.userActivityEventCollection.createIndex(
        {
          userId: 1,
          courseId: 1,
          courseVersionId: 1,
          videoId: 1,
          isDeleted: 1,
        },
        { background: true },
      );
    } catch (e) {
      // Index already exists
    }

    try {
      await this.userActivityEventCollection.createIndex(
        {
          userId: 1,
          videoId: 1,
          createdAt: -1,
        },
        { background: true },
      );
    } catch (e) {
      // Index already exists
    }
  }

  async getUserActivityEvents(
    userId: string,
    videoId?: string,
    courseId?: string,
    versionId?: string,
    session?: ClientSession
  ): Promise<IUserActivityEvent[]> {
    await this.init();
    
    const match: any = {
      userId: new ObjectId(userId),
      ...(videoId ? { videoId: new ObjectId(videoId) } : {}),
      ...(courseId ? { courseId: new ObjectId(courseId) } : {}),
      ...(versionId ? { courseVersionId: new ObjectId(versionId) } : {}),
      isDeleted: { $ne: true }
    };

    const events = await this.userActivityEventCollection
      .find(match, { session })
      .sort({ createdAt: 1 })
      .toArray();
    
    return events || [];
  }

  async createUserActivityEvent(
    userId: string,
    courseId: string,
    courseVersionId: string,
    videoId: string,
    session?: ClientSession,
  ): Promise<IUserActivityEvent> {
    await this.init();

    const userActivityEvent: IUserActivityEvent = {
      userId: new ObjectId(userId),
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(courseVersionId),
      videoId: new ObjectId(videoId), // itemId from system, stored as ObjectId
      rewinds: 0,
      fastForwards: 0,
      rewindData: [],
      fastForwardData: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.userActivityEventCollection.insertOne(userActivityEvent, {
      session,
    });

    if (result.acknowledged === false) {
      throw new InternalServerError('Failed to create user activity event record');
    }

    const newRecord = await this.userActivityEventCollection.findOne(
      { _id: result.insertedId },
      { session },
    );

    if (!newRecord) {
      throw new InternalServerError('Failed to retrieve created user activity event record');
    }

    return newRecord;
  }

  async getUserActivityEvent(
    userId: string,
    videoId: string,
    session?: ClientSession,
  ): Promise<IUserActivityEvent | null> {
    await this.init();

    const result = await this.userActivityEventCollection.findOne(
      {
        userId: new ObjectId(userId),
        videoId: new ObjectId(videoId), // Convert to ObjectId for query
        isDeleted: { $ne: true },
      },
      { session },
    );

    return result;
  }

  async updateUserActivityEvent(
    userId: string,
    videoId: string,
    data: Partial<IUserActivityEvent>,
    session?: ClientSession,
  ): Promise<IUserActivityEvent | null> {
    await this.init();

    const result = await this.userActivityEventCollection.findOneAndUpdate(
      {
        userId: new ObjectId(userId),
        videoId: new ObjectId(videoId), // Convert to ObjectId for query
        isDeleted: { $ne: true },
      },
      {
        $set: {
          ...data,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after', session },
    );

    return result;
  }
}

export { UserActivityEventRepository };
