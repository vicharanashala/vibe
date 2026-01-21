import { IProgress, IWatchTime } from '#shared/interfaces/models.js';
import { IAttempt } from '#quizzes/interfaces/grading.js';
import { injectable, inject } from 'inversify';
import { Collection, ObjectId, ClientSession } from 'mongodb';
import { MongoDatabase } from '../MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { InternalServerError } from 'routing-controllers';

type CurrentProgress = Pick<
  IProgress,
  'currentModule' | 'currentSection' | 'currentItem' | 'completed'
>;

@injectable()
class ProgressRepository {
  private progressCollection!: Collection<IProgress>;
  private watchTimeCollection!: Collection<IWatchTime>;
  private attemptCollection: Collection<IAttempt>;
  private initialized = false;

  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) { }

  private async init() {
    // Initialize only once to prevent catalog change errors
    if (this.initialized) {
      return;
    }
   
     

    this.progressCollection = await this.db.getCollection<IProgress>(
      'progress',
    );
    this.watchTimeCollection = await this.db.getCollection<IWatchTime>(
      'watchTime',
    );
    this.attemptCollection = await this.db.getCollection<IAttempt>(
      'quiz_attempts',
    );

      this.initialized = true;
  

    // Create indexes with background: true and error handling
    try {
      await this.progressCollection.createIndex(
        {
          userId: 1,
          courseId: 1,
          courseVersionId: 1,
        },
        { background: true },
      );
    } catch (e) {
      // Index already exists
    }

    try {
      await this.watchTimeCollection.createIndex(
        {
          userId: 1,
          courseId: 1,
          courseVersionId: 1,
          itemId: 1,
          isDeleted: 1,
        },
        { background: true },
      );
    } catch (e) {
      // Index already exists
    }

    try {
      await this.attemptCollection.createIndex(
        {
          userId: 1,
          quizId: 1,
        },
        { background: true },
      );
    } catch (e) {
      // Index already exists
    }
  }

  async getCompletedItems(
    userId: string,
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<string[]> {
    await this.init();

    const distinctItemIds = await this.watchTimeCollection.distinct(
      'itemId',
      {
        userId: new ObjectId(userId),
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
        endTime: { $exists: true, $ne: null },
        isDeleted: { $ne: true },
        
      },
      { session },
    );

    return distinctItemIds.map(id => id.toString());
  }

  async isItemCompleted(
    userId: string,
    courseId: string,
    courseVersionId: string,
    itemId: string,
    session?: ClientSession,
  ): Promise<boolean> {
    await this.init();

    const existing = await this.watchTimeCollection.findOne(
      {
        userId: new ObjectId(userId),
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
        itemId: new ObjectId(itemId),
        endTime: { $exists: true, $ne: null },
        isDeleted: { $ne: true },
      },
      { session, limit: 1 },
    );

    return existing !== null;
  }

  async getAllWatchTime(
    userId: string,
    session?: ClientSession,
  ): Promise<IWatchTime[]> {
    await this.init();
    const result = await this.watchTimeCollection
      .find({ userId: new ObjectId(userId), isDeleted: { $ne: true } }, { session })
      .toArray();
    return result.map(item => ({
      ...item,
      _id: item._id.toString(),
      userId: item.userId.toString(),
      courseId: item.courseId.toString(),
      courseVersionId: item.courseVersionId.toString(),
      itemId: item.itemId.toString(),
    }));
  }

  async deleteWatchTimeByItemId(
    itemId: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    await this.watchTimeCollection.updateMany(
      { itemId: new ObjectId(itemId) },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { session },
    );
  }

  async deleteWatchTimeByCourseId(
    courseId: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    const result = await this.watchTimeCollection.updateMany(
      { courseId: new ObjectId(courseId) },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { session },
    );
    if (result.modifiedCount === 0) {
      throw new Error(`No watch time records found for course ID: ${courseId}`);
    }
  }

  async deleteWatchTimeByVersionId(
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    const result = await this.watchTimeCollection.updateMany(
      { courseVersionId: new ObjectId(courseVersionId) },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { session },
    );
    if (result.modifiedCount === 0) {
      console.log(
        `No watch time records found for version ID: ${courseVersionId}`,
      );
      // throw new Error(`No watch time records found for version ID: ${courseVersionId}`);
    }
  }

  async deleteUserWatchTimeByCourseId(
    userId: string,
    courseId: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    const result = await this.watchTimeCollection.updateMany(
      { userId: new ObjectId(userId), courseId: new ObjectId(courseId) },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { session },
    );
    if (result.modifiedCount === 0) {
      throw new Error(
        `No watch time records found for user ID: ${userId} and course ID: ${courseId}`,
      );
    }
  }

  async deleteUserWatchTimeByCourseVersion(
    userId: string,
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    const result = await this.watchTimeCollection.updateMany(
      {
        userId: new ObjectId(userId),
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
      },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { session },
    );

    if (result?.modifiedCount === 0) {
      console.log(
        `No watch time records found for course version ID: ${courseVersionId}, user ID: ${userId} and course ID: ${courseId}`,
      );
      return;
    }
  }

  async deleteUserWatchTimeByItemId(
    userId: string,
    itemId: string,
    session?: ClientSession,
  ): Promise<{ deletedCount: number; remainingCount: number }> {
    await this.init();

    const deleteResult = await this.watchTimeCollection.updateMany(
      {
        userId: new ObjectId(userId),
        itemId: new ObjectId(itemId),
      },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { session },
    );

    const distinctItems = await this.watchTimeCollection.distinct(
      'itemId',
      { userId: new ObjectId(userId) },
      { session },
    );

    return {
      deletedCount: deleteResult.modifiedCount ?? 0,
      remainingCount: distinctItems.length,
    };
  }

  async executeBulkAttemptDelete(
    operations: Array<{ deleteOne: { filter: any } }>,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    if (operations.length) {
      await this.attemptCollection.bulkWrite(operations, { session });
    }
  }

  async prepareBulkQuizOperations(
    userId: string,
    quizItemIds: string[],
    maxAttemptsMap: Record<string, number>,
    session?: ClientSession,
  ): Promise<{
    attemptDeletes: Array<{ deleteOne: { filter: any } }>;
    metricsUpdates: Array<{ updateOne: { filter: any; update: any } }>;
    submissionDeletes: string[];
  }> {
    await this.init();
    const attemptDeletes: Array<{ deleteOne: { filter: any } }> = [];
    const metricsUpdates: Array<{ updateOne: { filter: any; update: any } }> = [];
    let submissionDeletes: string[] = [];

    for (const quizIdRaw of quizItemIds) {
      const quizIdStr = quizIdRaw.toString();
      const quizIdObj = new ObjectId(quizIdStr);

      const userIdStr = userId.toString();
      const userIdObj = new ObjectId(userIdStr);
      // 1. Fetch attempt having userId and quizId
      const docsToDelete = await this.attemptCollection
        .find(
          {
            userId: { $in: [userIdStr, userIdObj] },
            quizId: { $in: [quizIdStr, quizIdObj] },
          },
          { session },
        )
        .project({ _id: 1 })
        .toArray();

      // 2. If no docs then no need to include in bulk operation
      if (!docsToDelete.length) continue;

      // 3. push to attempts which we want to delete
      attemptDeletes.push({
        deleteOne: {
          filter: {
            userId: { $in: [userIdStr, userIdObj] },
            quizId: { $in: [quizIdStr, quizIdObj] },
          },
        },
      });

      // 4. push metrics reset options
      metricsUpdates.push({
        updateOne: {
          filter: {
            quizId: { $in: [quizIdStr, quizIdObj] },
            userId: { $in: [userIdStr, userIdObj] },
          },
          update: {
            $set: {
              attempts: [],
              latestAttemptId: null,
              latestSubmissionResultId: null,
              latestAttemptStatus: null,
              skipCount: 0,
              remainingAttempts: maxAttemptsMap[quizIdStr] || 0,
            },
          },
        },
      });
      // 5. push attempt ids to delete realted submissions
      submissionDeletes = submissionDeletes.concat(
        docsToDelete.map(d => d._id.toString()),
      );
    }

    return { attemptDeletes, metricsUpdates, submissionDeletes };
  }

  async deleteUserQuizAttemptsByCourseVersion(
    userId: string,
    quizId: string,
    session?: ClientSession,
  ): Promise<string[]> {
    try {
      await this.init();
      const docsToDelete = await this.attemptCollection
        .find({ userId, quizId }, { session })
        .project({ _id: 1 })
        .toArray();

      // if (!docsToDelete?.length) {
      //   throw new Error(
      //     `No quiz attempts found for user ID: ${userId}, quiz ID: ${quizId}`,
      //   );
      // }

      await this.attemptCollection.deleteMany({ userId, quizId }, { session });

      return docsToDelete.map(doc => doc._id.toString());
    } catch (error) {
      throw new InternalServerError(
        `Failed to delete quiz attempts /More ${error}`,
      );
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
        isDeleted: { $ne: true },
      },
      {
        session,
      },
    );
  }

  async deleteProgress(
    userId: string | ObjectId,
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    await this.progressCollection.updateOne(
      {
        userId: new ObjectId(userId),
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
      },
      { $set: { isDeleted: true, deletedAt: new Date() } },
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
      { _id: new ObjectId(id), isDeleted: { $ne: true } },
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
    const normalizedProgress: Partial<CurrentProgress> = {
      ...progress,

      currentModule:
        typeof progress.currentModule === 'string'
          ? new ObjectId(progress.currentModule)
          : progress.currentModule,

      currentSection:
        typeof progress.currentSection === 'string'
          ? new ObjectId(progress.currentSection)
          : progress.currentSection,

      currentItem:
        typeof progress.currentItem === 'string'
          ? new ObjectId(progress.currentItem)
          : progress.currentItem,
    };

    const result = await this.progressCollection.findOneAndUpdate(
      {
        userId: new ObjectId(userId),
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
      },
      { $set: normalizedProgress },
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
    watchTimeId: string,
    session?: ClientSession,
  ): Promise<IWatchTime | null> {
    await this.init();
    const result = await this.watchTimeCollection.findOneAndUpdate(
      {
        _id: new ObjectId(watchTimeId),
        isDeleted: { $ne: true },
      },
      { $set: { endTime: new Date() } },
      { returnDocument: 'after', session },
    );
    return result;
  }

  async getWatchTime(
    userId: string | ObjectId,
    itemId: string | string[],
    courseId?: string,
    courseVersionId?: string,
    session?: ClientSession,
  ): Promise<IWatchTime[] | null> {
    await this.init();

    // Build query dynamically and add logging
    const query: any = {
      userId: new ObjectId(userId),
      itemId: {
        $in: Array.isArray(itemId)
          ? itemId.map(id => new ObjectId(id))
          : [new ObjectId(itemId)],
      },
    };

    // Add optional courseId and courseVersionId if provided
    if (courseId) {
      query.courseId = new ObjectId(courseId);
    }
    if (courseVersionId) {
      query.courseVersionId = new ObjectId(courseVersionId);
    }
    query.isDeleted = { $ne: true };
    const result = await this.watchTimeCollection
      .find(query, { session })
      .toArray();
    return result.map(item => ({
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
        isDeleted: { $ne: true },
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
      {
        upsert: true, // ⭐ creates document if not found
        returnDocument: 'after', // return updated or inserted doc
        session,
      },
    );
    return result;
  }

  async getWatchTimeByVersion(
    userId: string,
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ) {
    await this.init();
    const result = await this.watchTimeCollection
      .find(
        {
          userId: new ObjectId(userId),
          courseId: new ObjectId(courseId),
          courseVersionId: new ObjectId(courseVersionId),
          isDeleted: { $ne: true },
        },
        { session },
      )
      .toArray();

    return result;
  }

  async deleteProgressByVersionId(versionId: string, session?: ClientSession) {
    await this.init();
    await this.progressCollection.updateMany(
      { courseVersionId: new ObjectId(versionId) },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { session },
    );
  }

  async getAllProgressForCourseVersion(
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<IProgress[]> {
    await this.init();
    const progressRecords = await this.progressCollection
      .find(
        {
          courseId: new ObjectId(courseId),
          courseVersionId: new ObjectId(courseVersionId),
        },
        { session },
      )
      .toArray();

    return progressRecords.map(progress => ({
      ...progress,
      _id: progress._id?.toString() || null,
      userId: progress.userId?.toString(),
      courseId: progress.courseId?.toString(),
      courseVersionId: progress.courseVersionId?.toString(),
      currentModule: progress.currentModule?.toString(),
      currentSection: progress.currentSection?.toString(),
      currentItem: progress.currentItem?.toString(),
    }));
  }
  async deleteUserProgressByVersionIds(
    courseVersionIds: ObjectId[],
    session?: ClientSession,
  ): Promise<boolean> {
    await this.init();
    if (!courseVersionIds.length) return false;
    const result = await this.progressCollection.deleteMany(
      {
        courseVersionId: { $in: courseVersionIds },
      },
      { session },
    );

    return result.acknowledged && result.deletedCount > 0;
  }

  async updateProgressByItemId(
    itemId: string,
    updateData: Partial<IProgress>,
    session?: ClientSession,
  ): Promise<number> {
    await this.init();
    const result = await this.progressCollection.updateMany(
      { currentItem: new ObjectId(itemId) },
      { $set: updateData },
      { session },
    );
    return result.modifiedCount;
  }

  async updateProgressBySectionId(
    sectionId: string,
    updateData: Partial<IProgress>,
    session?: ClientSession,
  ): Promise<number> {
    await this.init();
    const result = await this.progressCollection.updateMany(
      { currentSection: new ObjectId(sectionId) },
      { $set: updateData },
      { session },
    );
    return result.modifiedCount;
  }

  async updateProgressByModuleId(
    moduleId: string,
    updateData: Partial<IProgress>,
    session?: ClientSession,
  ): Promise<number> {
    await this.init();
    const result = await this.progressCollection.updateMany(
      { currentModule: new ObjectId(moduleId) },
      { $set: updateData },
      { session },
    );
    return result.modifiedCount;
  }

  async getUserProgressByVersionId(
    userId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<IProgress | null> {
    await this.init();
    const progress = await this.progressCollection.findOne(
      {
        userId: new ObjectId(userId),
        courseVersionId: new ObjectId(courseVersionId),
        isDeleted: { $ne: true },
      },
      { session },
    );
    return progress;
  }

  async deleteUserWatchTimeByItemIds(
    userId: string,

    itemIds: string[],

    session?: ClientSession,
  ): Promise<{ deletedCount: number }> {
    if (!itemIds.length) {
      return { deletedCount: 0 };
    }

    const result = await this.watchTimeCollection.deleteMany(
      {
        userId: new ObjectId(userId),

        itemId: { $in: itemIds.map(id => new ObjectId(id)) },
      },

      { session },
    );

    return {
      deletedCount: result.deletedCount ?? 0,
    };
  }

  async addBulkWatchTime(
    userId: string,

    courseId: string,

    versionId: string,

    itemIds: string[],

    session?: ClientSession,
  ) {
    await this.init();

    if (!itemIds.length) return { insertedCount: 0 };

    const now = new Date();

    const docs: IWatchTime[] = itemIds.map(itemId => ({
      userId: new ObjectId(userId),

      courseId: new ObjectId(courseId),

      courseVersionId: new ObjectId(versionId),

      itemId: new ObjectId(itemId),

      startTime: now,

      endTime: now,
      isBulk: true,
    }));

    const result = await this.watchTimeCollection.insertMany(docs, {
      session,
    });

    return {
      insertedCount: result.insertedCount,
    };
  }
}

export { ProgressRepository };
