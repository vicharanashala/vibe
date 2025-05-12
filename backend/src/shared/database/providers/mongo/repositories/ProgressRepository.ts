import 'reflect-metadata';
import {Collection, ObjectId} from 'mongodb';
import {Inject, Service} from 'typedi';
import {IEnrollment, IProgress, IWatchTime} from 'shared/interfaces/Models';
import {CreateError, ReadError, UpdateError} from 'shared/errors/errors';
import {MongoDatabase} from '../MongoDatabase';
import {NotFoundError} from 'routing-controllers';

type CurrentProgress = Pick<
  IProgress,
  'currentModule' | 'currentSection' | 'currentItem' | 'completed'
>;

@Service()
class ProgressRepository {
  private progressCollection: Collection<IProgress>;
  private watchTimeCollection: Collection<IWatchTime>;

  constructor(@Inject(() => MongoDatabase) private db: MongoDatabase) {}

  private async init() {
    this.progressCollection =
      await this.db.getCollection<IProgress>('progress');
    this.watchTimeCollection =
      await this.db.getCollection<IWatchTime>('watchTime');
  }

  /**
   * Find a progress record by useerId, courseId, and courseVersionId
   * @param userId - The ID of the user
   * @param courseId - The ID of the course
   * @param courseVersionId - The ID of the course version
   * @returns The progress record if found, or null if not found
   */
  async findProgress(
    userId: string,
    courseId: string,
    courseVersionId: string,
  ): Promise<IProgress | null> {
    await this.init();
    return await this.progressCollection.findOne({
      userId: new ObjectId(userId),
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(courseVersionId),
    });
  }

  /**
   * Find a progress record by ID
   * @param id - The ID of the progress record
   * @returns The progress record if found, or null if not found
   */
  async findById(id: string): Promise<IProgress | null> {
    await this.init();
    return await this.progressCollection.findOne({_id: new ObjectId(id)});
  }

  /**
   * Update an existing progress record
   */
  async updateProgress(
    userId: string,
    courseId: string,
    courseVersionId: string,
    progress: Partial<CurrentProgress>,
  ): Promise<IProgress | null> {
    await this.init();
    try {
      const result = await this.progressCollection.findOneAndUpdate(
        {
          userId: new ObjectId(userId),
          courseId: new ObjectId(courseId),
          courseVersionId: new ObjectId(courseVersionId),
        },
        {$set: progress},
        {returnDocument: 'after'},
      );
      if (!result._id) {
        console.log('Progress not found while updateing');
        throw new NotFoundError('Progress not found');
      }

      return result;
    } catch (error) {
      throw new UpdateError(
        `Failed to update progress tracking: ${error.message}`,
      );
    }
  }

  /**
   * Create a new progress tracking record
   */
  async createProgress(progress: IProgress): Promise<IProgress> {
    await this.init();
    try {
      const result = await this.progressCollection.insertOne(progress);
      if (!result.acknowledged) {
        throw new CreateError('Failed to create progress record');
      }

      const newProgress = await this.progressCollection.findOne({
        _id: result.insertedId,
      });

      if (!newProgress) {
        throw new NotFoundError('Newly created progress not found');
      }

      return newProgress;
    } catch (error) {
      throw new CreateError(
        `Failed to create progress tracking: ${error.message}`,
      );
    }
  }

  /**
   * Start watching an item
   * @param userId - The ID of the user
   * @param courseId - The ID of the course
   * @param courseVersionId - The ID of the course version
   * @param itemId - The ID of the item
   */
  async startItemTracking(
    userId: string,
    courseId: string,
    courseVersionId: string,
    itemId: string,
  ): Promise<string> {
    await this.init();
    try {
      const watchTime: IWatchTime = {
        userId: new ObjectId(userId),
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
        itemId: new ObjectId(itemId),
        startTime: new Date(),
        endTime: new Date(),
      };
      const result = await this.watchTimeCollection.insertOne(watchTime);

      if (!result.acknowledged) {
        throw new CreateError('Failed to start watching item');
      }

      return result.insertedId.toString();
    } catch (error) {
      throw new CreateError(`Failed to start watching item: ${error.message}`);
    }
  }
  async stopItemTracking(
    userId: string,
    courseId: string,
    courseVersionId: string,
    itemId: string,
    watchTimeId: string,
  ): Promise<IWatchTime | null> {
    await this.init();

    try {
      const result = await this.watchTimeCollection.findOneAndUpdate(
        {
          _id: new ObjectId(watchTimeId),
          userId: new ObjectId(userId),
          courseId: new ObjectId(courseId),
          courseVersionId: new ObjectId(courseVersionId),
          itemId: new ObjectId(itemId),
        },
        {$set: {endTime: new Date()}},
        {returnDocument: 'after'},
      );

      if (!result) {
        throw new NotFoundError('Watch time not found');
      }

      return result;
    } catch (error) {
      throw new UpdateError(`Failed to stop watching item: ${error.message}`);
    }
  }
  async getWatchTime(
    userId: string,
    courseId: string,
    courseVersionId: string,
    itemId: string,
  ): Promise<IWatchTime | null> {
    await this.init();
    const result = await this.watchTimeCollection.findOne({
      userId: new ObjectId(userId),
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(courseVersionId),
      itemId: new ObjectId(itemId),
    });

    return result;
  }

  async getWatchTimeById(id: string): Promise<IWatchTime | null> {
    await this.init();
    const result = await this.watchTimeCollection.findOne({
      _id: new ObjectId(id),
    });

    return result;
  }

  async findAndReplaceProgress(
    userId: string,
    courseId: string,
    courseVersionId: string,
    progress: Partial<IProgress>,
  ): Promise<IProgress | null> {
    await this.init();
    try {
      const result = await this.progressCollection.findOneAndUpdate(
        {
          userId: new ObjectId(userId),
          courseId: new ObjectId(courseId),
          courseVersionId: new ObjectId(courseVersionId),
        },
        {$set: progress},
        {returnDocument: 'after'},
      );

      if (!result) {
        throw new NotFoundError('Progress not found');
      }

      return result;
    } catch (error) {
      throw new UpdateError(
        `Failed to update progress tracking: ${error.message}`,
      );
    }
  }
}

export {ProgressRepository};
