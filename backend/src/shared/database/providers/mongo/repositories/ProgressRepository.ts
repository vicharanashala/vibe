
import {IProgress, IWatchTime} from '#shared/interfaces/models.js';
import {injectable, inject} from 'inversify';
import {Collection, ObjectId, ClientSession} from 'mongodb';
import {MongoDatabase} from '../MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';

type CurrentProgress = Pick<
  IProgress,
  'currentModule' | 'currentSection' | 'currentItem' | 'completed'
>;

@injectable()
class ProgressRepository {
  private progressCollection!: Collection<IProgress>;
  private watchTimeCollection!: Collection<IWatchTime>;

  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

  private async init() {
    this.progressCollection =
      await this.db.getCollection<IProgress>('progress');
    this.watchTimeCollection =
      await this.db.getCollection<IWatchTime>('watchTime');
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
      {_id: new ObjectId(id)},
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
      {$set: progress},
      {returnDocument: 'after', session},
    );
    return result;
  }

  async createProgress(
    progress: IProgress,
    session: ClientSession,
  ): Promise<IProgress> {
    await this.init();
    const result = await this.progressCollection.insertOne(progress, {session});
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
      {$set: {endTime: new Date()}},
      {returnDocument: 'after', session},
    );
    return result;
  }

  async getWatchTime(
    userId: string | ObjectId,
    courseId: string,
    courseVersionId: string,
    itemId: string,
    session?: ClientSession,
  ): Promise<IWatchTime | null> {
    await this.init();
    const result = await this.watchTimeCollection.findOne(
      {
        userId: new ObjectId(userId),
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
        itemId: new ObjectId(itemId),
      },
      {
        session,
      },
    );
    return result;
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
      {$set: progress},
      {returnDocument: 'after', session},
    );
    return result;
  }
}

export {ProgressRepository};
