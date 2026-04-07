import { IProgress, IWatchTime } from '#shared/interfaces/models.js';
import { IAttempt } from '#quizzes/interfaces/grading.js';
import { injectable, inject } from 'inversify';
import { Collection, ObjectId, ClientSession } from 'mongodb';
import { MongoDatabase } from '../MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { BadRequestError, InternalServerError } from 'routing-controllers';
import { ActiveUserDto, Course, CourseVersion, VideoUserAnalytics, VideoUserAnalyticsResponse } from '#root/modules/courses/classes/index.js';

type CurrentProgress = Pick<
  IProgress,
  'currentModule' | 'currentSection' | 'currentItem' | 'completed'
>;

@injectable()
class ProgressRepository {
  private progressCollection!: Collection<IProgress>;
  private watchTimeCollection!: Collection<IWatchTime>;
  private attemptCollection: Collection<IAttempt>;
  private courseCollection: Collection<Course>;
  private courseVersionCollection: Collection<CourseVersion>;
  private initialized = false;

  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) { }

  private async init() {
    // Initialize only once to prevent catalog change errors
    if (this.initialized) {
      return;
    }


    this.courseCollection = await this.db.getCollection<Course>('newCourse');
    this.courseVersionCollection = await this.db.getCollection<CourseVersion>(
      'newCourseVersion',
    );

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
    cohortId?: string,
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
        ...(cohortId ? { cohortId: new ObjectId(cohortId) } : {cohortId: null }),
      },
      { session },
    );
    const completedIds = distinctItemIds.map(id => id.toString());

    // get hidden/deleted
    const hiddenItems = await this.getHiddenOrDeletedItems(courseVersionId, session);
    const hiddenSet = new Set(hiddenItems.map(i => i.itemId.toString()));

    // filter out hidden/deleted items from completed items
    return completedIds.filter(id => !hiddenSet.has(id));
  }

  async getAllDistinctCompletedItems(
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
    cohortId?: string,
    session?: ClientSession,
  ): Promise<boolean> {
    await this.init();

    // let existing;
    // if(cohortId){
    //   existing = await this.watchTimeCollection.findOne(
    //   {
    //     userId: new ObjectId(userId),
    //     courseId: new ObjectId(courseId),
    //     courseVersionId: new ObjectId(courseVersionId),
    //     itemId: new ObjectId(itemId),
    //     ...(cohortId ? { cohortId: new ObjectId(cohortId) } : {}),
    //     endTime: { $exists: true, $ne: null },
    //     isDeleted: { $ne: true },
    //   },
    //   { session, limit: 1 },
    // );
    // } else{
    const  existing = await this.watchTimeCollection.findOne(
        {
          userId: new ObjectId(userId),
          courseId: new ObjectId(courseId),
          courseVersionId: new ObjectId(courseVersionId),
          ...(cohortId ? { cohortId: new ObjectId(cohortId) } : {cohortId: null }),
          itemId: new ObjectId(itemId),
          endTime: { $exists: true, $ne: null },
          isDeleted: { $ne: true },
        },
        { session, limit: 1 },
      );
    // }

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
    cohortId?: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    if (!this.watchTimeCollection) {
      console.log('[ProgressRepository] watchTimeCollection not initialized');
      return;
    }
    const result = await this.watchTimeCollection.updateMany(
      {
        userId: new ObjectId(userId),
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
        ...(cohortId ? { cohortId: new ObjectId(cohortId) } : {cohortId: null }),
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
    operations: Array<{ deleteMany: { filter: any } }>,
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
    cohortId?: string,
    session?: ClientSession,
  ): Promise<{
    attemptDeletes: Array<{ deleteMany: { filter: any } }>;
    metricsUpdates: Array<{ updateOne: { filter: any; update: any } }>;
    submissionDeletes: string[];
  }> {
    await this.init();
    const attemptDeletes: Array<{ deleteMany: { filter: any } }> = [];
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
            ...(cohortId ? { cohortId: new ObjectId(cohortId) } : {cohortId: null}),
          },
          { session },
        )
        .project({ _id: 1 })
        .toArray();

      // 2. If no docs then no need to include in bulk operation
      if (!docsToDelete.length) continue;

      // 3. push to attempts which we want to delete
      attemptDeletes.push({
        deleteMany: {
          filter: {
            userId: { $in: [userIdStr, userIdObj] },
            quizId: { $in: [quizIdStr, quizIdObj] },
            ...(cohortId ? { cohortId: new ObjectId(cohortId) } : {cohortId: null }),
          },
        },
      });

      // 4. push metrics reset options
      metricsUpdates.push({
        updateOne: {
          filter: {
            quizId: { $in: [quizIdStr, quizIdObj] },
            userId: { $in: [userIdStr, userIdObj] },
            ...(cohortId ? { cohortId: new ObjectId(cohortId) } : {cohortId: null}),
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
    cohortId?: string,
    session?: ClientSession,
  ): Promise<IProgress | null> {
    await this.init();
    return await this.progressCollection.findOne(
      {
        userId: { $in: [new ObjectId(userId), userId] },
        courseId: { $in: [new ObjectId(courseId), courseId] },
        courseVersionId: { $in: [new ObjectId(courseVersionId), courseVersionId] },
        isDeleted: { $ne: true },
        ...(cohortId ? { cohortId: new ObjectId(cohortId) } : {cohortId: null}),
      },
      {
        session,
      }
    );
  }

  async deleteProgress(
    userId: string | ObjectId,
    courseId: string,
    courseVersionId: string,
    cohort?: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    await this.progressCollection.updateOne(
      {
        userId: { $in: [new ObjectId(userId), userId] },
        courseId: { $in: [new ObjectId(courseId), courseId] },
        courseVersionId: { $in: [new ObjectId(courseVersionId), courseVersionId] },
        ...(cohort ? { cohort } : {}),
      },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      {
        session,
      },
    );
  }

  async findById(
    id: string,
    session?: ClientSession,
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
    cohortId?: string,
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
        userId: { $in: [new ObjectId(userId), userId] },
        courseId: { $in: [new ObjectId(courseId), courseId] },
        courseVersionId: { $in: [new ObjectId(courseVersionId), courseVersionId] },
        ...(cohortId ? { cohortId: new ObjectId(cohortId) } : {cohortId: null}),
        isDeleted: { $ne: true },
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
    cohortId?: string,
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
    if(cohortId){
      watchTime.cohortId = new ObjectId(cohortId);
    }
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
    cohortId?: string,
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
    if (cohortId) {
      query.cohortId = new ObjectId(cohortId);
    } else {
      query.$or = [
        { cohortId: null },
        { cohortId: { $exists: false } },
      ];
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
    cohortId?: string,
    session?: ClientSession,
  ): Promise<IProgress | null> {
    await this.init();
    const result = await this.progressCollection.findOneAndUpdate(
      {
        userId: { $in: [new ObjectId(userId), userId] },
        courseId: { $in: [new ObjectId(courseId), courseId] },
        courseVersionId: { $in: [new ObjectId(courseVersionId), courseVersionId] },
        ...(cohortId ? { cohortId: new ObjectId(cohortId) } : {cohortId: null}),
        isDeleted: { $ne: true },
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
      { courseVersionId: { $in: [new ObjectId(versionId), versionId] }, },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { session },
    );
  }

  async getAllProgressForCourseVersion(
    courseId: string,
    courseVersionId: string,
    cohortId?: string,
    session?: ClientSession,
  ): Promise<IProgress[]> {
    await this.init();
    const progressRecords = await this.progressCollection
      .find(
        {
          courseId: { $in: [new ObjectId(courseId), courseId] },
          courseVersionId: { $in: [new ObjectId(courseVersionId), courseVersionId] },
          ...(cohortId ? { cohortId: new ObjectId(cohortId) } : {cohortId: null}),
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
      { currentItem: { $in: [new ObjectId(itemId), itemId] } },
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
      { currentSection: { $in: [new ObjectId(sectionId), sectionId] } },
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
      { currentModule: { $in: [new ObjectId(moduleId), moduleId] } },
      { $set: updateData },
      { session },
    );
    return result.modifiedCount;
  }

  async getUserProgressByVersionId(
    userId: string,
    courseVersionId: string,
    cohort?: string,
    session?: ClientSession,
  ): Promise<IProgress | null> {
    await this.init();
    const progress = await this.progressCollection.findOne(
      {
        userId: { $in: [new ObjectId(userId), userId] },
        courseVersionId: { $in: [new ObjectId(courseVersionId), courseVersionId] },
        ...(cohort ? { cohortId: new ObjectId(cohort) } : {}),
        isDeleted: { $ne: true },
      },
      { session },
    );
    return progress;
  }

  async deleteUserWatchTimeByItemIds( // change according to cohort
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
    cohortId?: string,
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
      ...(cohortId ? { cohortId: new ObjectId(cohortId) } : {}),
    }));

    const result = await this.watchTimeCollection.insertMany(docs, {
      session,
    });

    return {
      insertedCount: result.insertedCount,
    };
  }

  async getActiveUsers(
    courseId?: string,
    courseVersionId?: string,
    startTimeStamp?: string,
    endTimeStamp?: string,
  ): Promise<{
    courseName?: string;
    courseVersionName?: string;
    activeUsers: ActiveUserDto[];
  }> {
    await this.init();

    const matchConditions: any = {
      isDeleted: { $ne: true },
    };

    if (courseId) {
      matchConditions.courseId = new ObjectId(courseId);
    }

    if (courseVersionId) {
      matchConditions.courseVersionId = new ObjectId(courseVersionId);
    }

    if (startTimeStamp || endTimeStamp) {
      matchConditions.startTime = {};

      if (startTimeStamp) {
        const startEpoch = Number(startTimeStamp);
        if (!Number.isFinite(startEpoch)) {
          throw new BadRequestError(
            'Invalid startTimeStamp. Expected Unix epoch time in milliseconds.',
          );
        }
        matchConditions.startTime.$gte = new Date(startEpoch);
      }

      if (endTimeStamp) {
        const endEpoch = Number(endTimeStamp);
        if (!Number.isFinite(endEpoch)) {
          throw new BadRequestError(
            'Invalid endTimeStamp. Expected Unix epoch time in milliseconds.',
          );
        }
        matchConditions.startTime.$lte = new Date(endEpoch);
      }
    }

    /* -----------------------------
       Fetch Active Users
    ------------------------------ */
    const activeUsers = (await this.watchTimeCollection
      .aggregate([
        { $match: matchConditions },
        {
          $group: {
            _id: '$userId',
            lastActiveTime: { $max: '$startTime' },
          },
        },
        { $sort: { lastActiveTime: -1 } },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        {
          $project: {
            _id: 0,
            firstName: '$user.firstName',
            email: '$user.email',
            lastActiveTime: {
              $dateToString: {
                date: '$lastActiveTime',
                format: '%d-%m-%Y %H:%M:%S',
                timezone: 'Asia/Kolkata',
              },
            },
          },
        },
      ])
      .toArray()) as ActiveUserDto[];

    /* -----------------------------
       Fetch Course / Version Names
    ------------------------------ */
    let courseName: string | undefined;
    let courseVersionName: string | undefined;

    if (courseId) {
      const course = await this.courseCollection.findOne(
        { _id: new ObjectId(courseId), isDeleted: { $ne: true } },
        { projection: { name: 1 } },
      );
      courseName = course?.name;
    }

    if (courseVersionId) {
      const version = await this.courseVersionCollection.findOne(
        { _id: new ObjectId(courseVersionId), isDeleted: { $ne: true } },
        { projection: { version: 1 } },
      );
      courseVersionName = version?.version;
    }

    return {
      courseName,
      courseVersionName,
      activeUsers,
    };
  }

    async isItemAttempted(
    userId: string,
    courseId: string,
    courseVersionId: string,
    itemId: string,
    cohortId?: string,
    session?: ClientSession,
  ): Promise<boolean> {
    await this.init();

    const existing = await this.watchTimeCollection.findOne(
      {
        userId: new ObjectId(userId),
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
        itemId: new ObjectId(itemId),
        ...(cohortId ? { cohortId: new ObjectId(cohortId) } : {cohortId: null}),
        isDeleted: { $ne: true },
      },
      { session, limit: 1 },
    );

    return existing !== null;
  }


  async getWatchTimeByItemId(itemId: string): Promise<IWatchTime[]> {
    await this.init();
    const result = await this.watchTimeCollection
      .find(
        {
          itemId: new ObjectId(itemId),
          isDeleted: { $ne: true },
        },
      )
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


  async getVideoUserAnalytics(
    courseId: string,
    versionId: string,
    videoId: string,
    page: number,
    limit: number,
    search?: string,
    sortBy: 'name' | 'views' | 'watchHours' = 'name',
    sortOrder: 'asc' | 'desc' = 'asc',
    maxSecondsPerView: number = 10 * 60,
  ): Promise<VideoUserAnalyticsResponse> {
    await this.init();

    const safePage = Math.max(1, page || 1);
    const safeLimit = Math.min(Math.max(1, limit || 10), 200);
    const skip = (safePage - 1) * safeLimit;
    const capMs = Math.max(1, Math.floor(maxSecondsPerView * 1000));

    // Map sortBy to MongoDB field names
    const sortFieldMap = {
      name: 'user.firstName',
      views: 'viewCount',
      watchHours: 'totalWatchMs'
    };
    const sortField = sortFieldMap[sortBy] || 'user.firstName';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [result] = await this.watchTimeCollection
      .aggregate([
        {
          $match: {
            courseId: new ObjectId(courseId),
            courseVersionId: new ObjectId(versionId),
            itemId: new ObjectId(videoId),
            isDeleted: { $ne: true },
          },
        },

        {
          $group: {
            _id: "$userId",

            viewCount: {
              $sum: { $cond: [{ $ne: ["$startTime", null] }, 1, 0] },
            },

            totalWatchMs: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$startTime", null] },
                      { $ne: ["$endTime", null] },
                    ],
                  },
                  {
                    $let: {
                      vars: {
                        rawMs: { $subtract: ["$endTime", "$startTime"] },
                      },
                      in: {
                        $cond: [
                          { $gt: ["$$rawMs", 0] },
                          { $min: ["$$rawMs", capMs] },
                          0,
                        ],
                      },
                    },
                  },
                  0,
                ],
              },
            },
          },
        },

        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },

        // Apply dynamic sorting
        { $sort: { [sortField]: sortDirection } },

        ...(search
          ? [
            {
              $match: {
                $or: [
                  { "user.firstName": { $regex: search, $options: "i" } },
                  { "user.email": { $regex: search, $options: "i" } },
                ],
              },
            },
          ]
          : []),

        {
          $facet: {
            data: [
              { $skip: skip },
              { $limit: safeLimit },
              {
                $project: {
                  _id: 0,
                  userId: { $toString: "$_id" },
                  firstName: "$user.firstName",
                  email: "$user.email",
                  viewCount: 1,

                  totalWatchTime: {
                    $let: {
                      vars: {
                        minutes: { $floor: { $divide: ["$totalWatchMs", 60000] } },
                        seconds: {
                          $floor: {
                            $divide: [{ $mod: ["$totalWatchMs", 60000] }, 1000],
                          },
                        },
                      },
                      in: {
                        $concat: [
                          {
                            $cond: [
                              { $lt: ["$$minutes", 10] },
                              { $concat: ["0", { $toString: "$$minutes" }] },
                              { $toString: "$$minutes" },
                            ],
                          },
                          ":",
                          {
                            $cond: [
                              { $lt: ["$$seconds", 10] },
                              { $concat: ["0", { $toString: "$$seconds" }] },
                              { $toString: "$$seconds" },
                            ],
                          },
                        ],
                      },
                    },
                  },
                },
              },
            ],
            meta: [{ $count: "totalDocuments" }],
          },
        },

        {
          $addFields: {
            totalDocuments: {
              $ifNull: [{ $arrayElemAt: ["$meta.totalDocuments", 0] }, 0],
            },
          },
        },

        {
          $addFields: {
            totalPages: {
              $cond: [
                { $gt: ["$totalDocuments", 0] },
                { $ceil: { $divide: ["$totalDocuments", safeLimit] } },
                0,
              ],
            },
          },
        },

        {
          $project: {
            data: 1,
            totalDocuments: 1,
            totalPages: 1,
          },
        },
      ])
      .toArray();

    return {
      data: (result?.data ?? []) as VideoUserAnalytics[],
      totalDocuments: result?.totalDocuments ?? 0,
      totalPages: result?.totalPages ?? 0,
      page: safePage,
      limit: safeLimit,
    };
  }

  async getCourseVersionTotalWatchTime(
    courseId: string,
    versionId: string,
    maxSecondsPerView: number = 10 * 60,
  ): Promise<number> {
    await this.init();

    const capMs = Math.max(1, Math.floor(maxSecondsPerView * 1000));

    const result = await this.watchTimeCollection
      .aggregate([
        {
          $match: {
            courseId: new ObjectId(courseId),
            courseVersionId: new ObjectId(versionId),
            isDeleted: { $ne: true },
            startTime: { $ne: null },
            endTime: { $ne: null },
          },
        },

        {
          $addFields: {
            diffMs: { $subtract: ['$endTime', '$startTime'] },
          },
        },

        {
          $group: {
            _id: null,
            totalMs: {
              $sum: {
                $cond: [
                  { $gt: ['$diffMs', 0] },
                  { $min: ['$diffMs', capMs] },
                  0,
                ],
              },
            },
          },
        },
      ])
      .toArray();

    const totalMs = result?.[0]?.totalMs ?? 0;

    return Math.floor(totalMs / 1000);
  }

  /**
   * Per-user total watch seconds for a course version, using the same capped
   * session-length rules as {@link getCourseVersionTotalWatchTime}.
   */
  async getWatchTimeSecondsByUserForCourseVersion(
    courseId: string,
    versionId: string,
    maxSecondsPerView: number = 10 * 60,
  ): Promise<Array<{ userId: string; totalSeconds: number }>> {
    await this.init();

    const capMs = Math.max(1, Math.floor(maxSecondsPerView * 1000));

    const rows = await this.watchTimeCollection
      .aggregate([
        {
          $match: {
            courseId: new ObjectId(courseId),
            courseVersionId: new ObjectId(versionId),
            isDeleted: { $ne: true },
            startTime: { $ne: null },
            endTime: { $ne: null },
          },
        },
        {
          $addFields: {
            diffMs: { $subtract: ['$endTime', '$startTime'] },
          },
        },
        {
          $group: {
            _id: '$userId',
            totalMs: {
              $sum: {
                $cond: [
                  { $gt: ['$diffMs', 0] },
                  { $min: ['$diffMs', capMs] },
                  0,
                ],
              },
            },
          },
        },
      ])
      .toArray();

    return rows.map(r => ({
      userId: r._id?.toString() ?? '',
      totalSeconds: Math.floor((r.totalMs as number) / 1000),
    }));
  }

  async getHiddenOrDeletedItems(
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<
    { itemId: string;}[]
  > {
    await this.init();

    const results = await this.courseVersionCollection
      .aggregate(
        [
          {
            $match: {
              _id: new ObjectId(courseVersionId),
            },
          },

          { $unwind: "$modules" },
          { $unwind: "$modules.sections" },

          {
            $lookup: {
              from: "itemsGroup",
              localField: "modules.sections.itemsGroupId",
              foreignField: "_id",
              as: "itemsGroup",
            },
          },

          { $unwind: "$itemsGroup" },
          { $unwind: "$itemsGroup.items" },

          {
            $match: {
              $or: [
                { "itemsGroup.items.isHidden": true },
                { "itemsGroup.items.isDeleted": true },
              ],
            },
          },

          {
            $project: {
              _id: 0,
              itemId: { $toString: "$itemsGroup.items._id" },
            },
          },
        ],
        { session },
      )
      .toArray();

    return results as {
      itemId: string;
    }[];
  }

  async findWatchTimeById(
    id: string,
    session?: ClientSession,
  ): Promise<IWatchTime | null> {
    await this.init();
    return await this.watchTimeCollection.findOne(
      { _id: new ObjectId(id), isDeleted: { $ne: true } },
      {
        session,
      },
    );
  }

  /**
   * Get unique dates (IST calendar days) when a student had completed activity.
   * Only considers watchTime records where endTime exists (i.e., item was completed).
   * Returns dates sorted newest-first, limited to last 365 days.
   */
  async getStudentActivityDates(
    userId: string,
    session?: ClientSession,
  ): Promise<string[]> {
    await this.init();

    const results = await this.watchTimeCollection
      .aggregate(
        [
          {
            $match: {
              userId: new ObjectId(userId),
              endTime: { $exists: true, $ne: null },
              isDeleted: { $ne: true },
            },
          },
          {
            $project: {
              date: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$endTime',
                  timezone: 'Asia/Kolkata',
                },
              },
            },
          },
          { $group: { _id: '$date' } },
          { $sort: { _id: -1 } },
          { $limit: 365 },
        ],
        { session },
      )
      .toArray();

    return results.map((r: any) => r._id as string);
  }

}

export { ProgressRepository };