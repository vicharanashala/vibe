import {
  EnrollmentRole,
  IEnrollment,
  IProgress,
  ICourseVersion,
  IWatchTime,
  IUser
} from '#shared/interfaces/models.js';
import { injectable, inject } from 'inversify';
import { ClientSession, Collection, ObjectId } from 'mongodb';
import { InternalServerError, NotFoundError } from 'routing-controllers';
import { MongoDatabase } from '../MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { EnrollmentStats } from '#root/modules/users/types.js';
import { StudentQuizScoreDto, QuizScoresExportResponseDto } from '#root/modules/users/dtos/QuizScoresExportDto.js';
import { ISubmission } from '#root/modules/quizzes/interfaces/grading.js';
import { ItemsGroup, QuizItem } from '#root/modules/courses/classes/index.js';
import { AttemptRepository } from '#root/modules/quizzes/repositories/index.js';
import { QUIZZES_TYPES } from '#root/modules/quizzes/types.js';


@injectable()
export class EnrollmentRepository {
  private enrollmentCollection!: Collection<IEnrollment>;
  private progressCollection!: Collection<IProgress>;
  private courseVersionCollection!: Collection<ICourseVersion>;
  private watchTimeCollection!: Collection<IWatchTime>;
  private submissionCollection!: Collection<ISubmission>;
  private quizCollection!: Collection<QuizItem>;
  private itemsGroupCollection!: Collection<ItemsGroup>;

  constructor(
    @inject(QUIZZES_TYPES.AttemptRepo)
    private attemptRepository: AttemptRepository,
    @inject(GLOBAL_TYPES.Database) private db: MongoDatabase) { }

  private async init() {
    this.enrollmentCollection = await this.db.getCollection<IEnrollment>(
      'enrollment',
    );
    this.progressCollection = await this.db.getCollection<IProgress>(
      'progress',
    );
    this.courseVersionCollection = await this.db.getCollection<ICourseVersion>(
      'newCourseVersion',
    );
    this.watchTimeCollection = await this.db.getCollection<IWatchTime>(
      'watchTime',
    );
    this.submissionCollection = await this.db.getCollection<ISubmission>(
      'quiz_submission_results',
    );
    this.quizCollection = await this.db.getCollection<QuizItem>(
      'quizzes'
    );
    this.itemsGroupCollection = await this.db.getCollection<ItemsGroup>(
      'itemsGroup'
    );
  }

  /**
   * Find an enrollment by ID
   */
  async findById(id: string): Promise<IEnrollment | null> {
    await this.init();
    try {
      return await this.enrollmentCollection.findOne({ _id: new ObjectId(id) });
    } catch (error) {
      console.error('Error finding enrollment by ID:', error);
      throw error;
    }
  }

  async findEnrollment(
    userId: string | ObjectId,
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<IEnrollment | null> {
    await this.init();

    const courseObjectId = new ObjectId(courseId);
    const courseVersionObjectId = new ObjectId(courseVersionId);

    const userObjectid = new ObjectId(userId);

    return await this.enrollmentCollection.findOne(
      {
        userId: userObjectid,
        courseId: courseObjectId,
        courseVersionId: courseVersionObjectId,
      },
      { session },
    );
  }

  async updateProgressPercentById(
    enrollmentId: string,
    percentCompleted: number,
    session?: ClientSession
  ): Promise<void> {
    try {
      await this.init();
      await this.enrollmentCollection.findOneAndUpdate(
        { _id: new ObjectId(enrollmentId) },
        { $set: { percentCompleted } },
        { session },
      );
    } catch (error) {
      throw new InternalServerError(
        `Failed to update progress in enrollment. More/${error}`
      );
    }
  }
  /**
   * Create a new enrollment record
   */
  async createEnrollment(
    enrollment: IEnrollment,
    session?: ClientSession,
  ): Promise<IEnrollment> {
    await this.init();
    try {
      const result = await this.enrollmentCollection.insertOne(enrollment, {
        session,
      });
      if (!result.acknowledged) {
        throw new InternalServerError('Failed to create enrollment record');
      }

      const newEnrollment = await this.enrollmentCollection.findOne(
        {
          _id: result.insertedId,
        },
        { session },
      );

      if (!newEnrollment) {
        throw new NotFoundError('Newly created enrollment not found');
      }

      return newEnrollment;
    } catch (error) {
      throw new InternalServerError(
        `Failed to create enrollment: ${error.message}`,
      );
    }
  }
  /**
   * Delete an enrollment record for a user in a specific course version
   */
  async deleteEnrollment(
    userId: string,
    courseId: string,
    courseVersionId: string,
    session?: any,
  ): Promise<void> {
    await this.init();

    const courseObjectId = new ObjectId(courseId);
    const courseVersionObjectId = new ObjectId(courseVersionId);

    // temp: Try both userId as string and ObjectId (if valid)
    const userFilter = [
      userId,
      ObjectId.isValid(userId) ? new ObjectId(userId) : null,
    ].filter(Boolean);

    // const userObjectid = new ObjectId(userId)

    const result = await this.enrollmentCollection.deleteOne(
      {
        userId: { $in: userFilter },
        courseId: courseObjectId,
        courseVersionId: courseVersionObjectId,
      },
      { session },
    );
    if (result.deletedCount === 0) {
      throw new NotFoundError('Enrollment not found to delete');
    }
  }

  /**
   * Create a new progress tracking record
   */
  async createProgress(
    progress: IProgress,
    session?: ClientSession,
  ): Promise<IProgress> {
    await this.init();
    try {
      const result = await this.progressCollection.insertOne(progress, {
        session,
      });
      if (!result.acknowledged) {
        throw new InternalServerError('Failed to create progress record');
      }

      const newProgress = await this.progressCollection.findOne(
        {
          _id: result.insertedId,
        },
        { session },
      );

      if (!newProgress) {
        throw new NotFoundError('Newly created progress not found');
      }

      return newProgress;
    } catch (error) {
      throw new InternalServerError(
        `Failed to create progress tracking: ${error.message}`,
      );
    }
  }

  async deleteProgress(
    userId: string,
    courseId: string,
    courseVersionId: string,
    session?: any,
  ): Promise<void> {
    await this.init();
    await this.progressCollection.deleteMany(
      {
        userId: new ObjectId(userId),
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
      },
      { session },
    );
  }

  async getEnrollments(
    userId: string,
    skip: number,
    limit: number,
    search: string,
    role: EnrollmentRole,
    session?: ClientSession,
  ) {
    try {
      await this.init();
      const userObjectId = new ObjectId(userId);

      const aggregationPipeline: any[] = [
        { $match: { userId: userObjectId, role } },
        { $sort: { enrollmentDate: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'newCourse',
            localField: 'courseId',
            foreignField: '_id',
            as: 'course',
            pipeline: [{ $project: { name: 1, versions: 1 } }],
          },
        },
        { $unwind: { path: '$course', preserveNullAndEmptyArrays: true } },
        // Lookup content counts (optimized)
        {
          $lookup: {
            from: 'newCourseVersion',
            let: { versionId: '$courseVersionId' },
            pipeline: [
              { $match: { $expr: { $eq: ['$_id', '$$versionId'] } } },
              {
                $project: {
                  itemGroupIds: {
                    $reduce: {
                      input: {
                        $map: {
                          input: '$modules',
                          as: 'm',
                          in: {
                            $map: {
                              input: '$$m.sections',
                              as: 's',
                              in: '$$s.itemsGroupId',
                            },
                          },
                        },
                      },
                      initialValue: [],
                      in: { $concatArrays: ['$$value', '$$this'] },
                    },
                  },
                },
              },
              { $unwind: '$itemGroupIds' },
              {
                $addFields: {
                  itemGroupObjId: { $toObjectId: '$itemGroupIds' },
                },
              },
              {
                $lookup: {
                  from: 'itemsGroup',
                  localField: 'itemGroupObjId',
                  foreignField: '_id',
                  as: 'itemsGroup',
                },
              },
              { $unwind: '$itemsGroup' },
              { $unwind: '$itemsGroup.items' },
              {
                $group: {
                  _id: '$_id',
                  totalItems: { $sum: 1 },
                  videos: {
                    $sum: {
                      $cond: [{ $eq: ['$itemsGroup.items.type', 'VIDEO'] }, 1, 0],
                    },
                  },
                  quizzes: {
                    $sum: {
                      $cond: [{ $eq: ['$itemsGroup.items.type', 'QUIZ'] }, 1, 0],
                    },
                  },
                  articles: {
                    $sum: {
                      $cond: [
                        { $eq: ['$itemsGroup.items.type', 'ARTICLE'] },
                        1,
                        0,
                      ],
                    },
                  },
                },
              },
            ],
            as: 'contentCounts',
          },
        },
        {
          $set: {
            contentCounts: {
              $ifNull: [
                { $arrayElemAt: ['$contentCounts', 0] },
                { totalItems: 0, videos: 0, quizzes: 0, articles: 0 },
              ],
            },
          },
        },
        // Lookup watched items (optimized)
        {
          $lookup: {
            from: 'watchTime',
            let: {
              userId: '$userId',
              courseId: '$courseId',
              courseVersionId: '$courseVersionId',
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$userId', '$$userId'] },
                      { $eq: ['$courseId', '$$courseId'] },
                      { $eq: ['$courseVersionId', '$$courseVersionId'] },
                    ],
                  },
                },
              },
              {
                $group: {
                  _id: null,
                  distinctItemIds: { $addToSet: '$itemId' },
                },
              },
            ],
            as: 'watchedItems',
          },
        },
        {
          $set: {
            watchedItemCount: {
              $size: {
                $ifNull: [
                  { $arrayElemAt: ['$watchedItems.distinctItemIds', 0] },
                  [],
                ],
              },
            },
          },
        },
        { $unset: 'watchedItems' },
        // Only add search filter if search is provided
        ...(search && search.trim()
          ? [{ $match: { 'course.name': { $regex: search, $options: 'i' } } }]
          : []),
        // Project only required fields
        {
          $project: {
            _id: { $toString: '$_id' },
            courseId: { $toString: '$courseId' },
            courseVersionId: { $toString: '$courseVersionId' },
            role: 1,
            status: 1,
            enrollmentDate: 1,
            course: 1,
            percentCompleted: { $ifNull: ['$percentCompleted', 0] },
            contentCounts: 1,
            watchedItemCount: 1,
          },
        },
      ];

      return await this.enrollmentCollection
        .aggregate(aggregationPipeline, { session })
        .toArray();
    } catch (error) {
      console.log(error);
      throw new InternalServerError(`Failed to get enrollments /More ${error}`);
    }
  }

  async getBasicEnrollments(
    userId: string,
    skip: number,
    limit: number,
    role: EnrollmentRole,
    search: string,
    session?: ClientSession,
  ) {
    await this.init();
    const userObjectId = new ObjectId(userId);
    const pipeline: any[] = [
      { $match: { userId: userObjectId, role } },
      { $sort: { enrollmentDate: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'newCourse',
          localField: 'courseId',
          foreignField: '_id',
          as: 'course',
          pipeline: [
            {
              $project: {
                name: 1,
                versions: {
                  $map: {
                    input: '$versions',
                    as: 'v',
                    in: { $toString: '$$v' },
                  },
                },
                description: 1,
                updatedAt: 1,
              },
            },
          ],
        },
      },
      { $unwind: { path: '$course', preserveNullAndEmptyArrays: true } },
      ...(search?.trim()
        ? [{ $match: { 'course.name': { $regex: search, $options: 'i' } } }]
        : []),
      {
        $project: {
          _id: 1,
          courseId: 1,
          courseVersionId: 1,
          role: 1,
          status: 1,
          enrollmentDate: 1,
          course: 1,
          percentCompleted: { $ifNull: ['$percentCompleted', 0] },
        },
      },
    ];

    return await this.enrollmentCollection
      .aggregate(pipeline, { session })
      .toArray();
  }

  async getContentCountsForVersions(
    versionIds: ObjectId[],
  ): Promise<Map<string, any>> {
    const results = await this.courseVersionCollection
      .aggregate([
        { $match: { _id: { $in: versionIds } } },
        {
          $project: {
            _id: 1,
            itemGroupIds: {
              $reduce: {
                input: {
                  $map: {
                    input: '$modules',
                    as: 'm',
                    in: {
                      $map: {
                        input: '$$m.sections',
                        as: 's',
                        in: '$$s.itemsGroupId',
                      },
                    },
                  },
                },
                initialValue: [],
                in: { $concatArrays: ['$$value', '$$this'] },
              },
            },
          },
        },
        { $unwind: '$itemGroupIds' },
        {
          $addFields: {
            itemGroupObjId: { $toObjectId: '$itemGroupIds' },
          },
        },
        {
          $lookup: {
            from: 'itemsGroup',
            localField: 'itemGroupObjId',
            foreignField: '_id',
            as: 'itemsGroup',
          },
        },
        { $unwind: '$itemsGroup' },
        { $unwind: '$itemsGroup.items' },
        {
          $group: {
            _id: '$_id',
            totalItems: { $sum: 1 },
            videos: {
              $sum: { $cond: [{ $eq: ['$itemsGroup.items.type', 'VIDEO'] }, 1, 0] },
            },
            quizzes: {
              $sum: { $cond: [{ $eq: ['$itemsGroup.items.type', 'QUIZ'] }, 1, 0] },
            },
            articles: {
              $sum: {
                $cond: [{ $eq: ['$itemsGroup.items.type', 'ARTICLE'] }, 1, 0],
              },
            },
          },
        },
      ])
      .toArray();

    const map = new Map<string, any>();
    for (const doc of results) {
      map.set(doc._id.toString(), {
        totalItems: doc.totalItems,
        videos: doc.videos,
        quizzes: doc.quizzes,
        articles: doc.articles,
      });
    }
    return map;
  }

  async getWatchedItemCountsBatch(
    entries: {
      userId: ObjectId;
      courseId: ObjectId;
      courseVersionId: ObjectId;
    }[],
  ): Promise<Map<string, number>> {
    const matchConditions = entries.map(e => ({
      userId: e.userId,
      courseId: e.courseId,
      courseVersionId: e.courseVersionId,
    }));

    const results = await this.watchTimeCollection
      .aggregate([
        { $match: { $or: matchConditions } },
        {
          $group: {
            _id: {
              userId: '$userId',
              courseId: '$courseId',
              courseVersionId: '$courseVersionId',
            },
            itemIds: { $addToSet: '$itemId' },
          },
        },
        {
          $project: {
            _id: 1,
            count: { $size: '$itemIds' },
          },
        },
      ])
      .toArray();

    const map = new Map<string, number>();
    for (const doc of results) {
      const key = `${doc._id.userId.toString()}-${doc._id.courseId.toString()}-${doc._id.courseVersionId.toString()}`;
      map.set(key, doc.count);
    }

    return map;
  }

  async getAllEnrollments(userId: string, session?: ClientSession) {
    await this.init();

    // temp: Try both userId as string and ObjectId (if valid)
    const userFilter = [
      userId,
      ObjectId.isValid(userId) ? new ObjectId(userId) : null,
    ].filter(Boolean);

    // const userObjectid = new ObjectId(userId)

    return await this.enrollmentCollection
      .find({ userId: { $in: userFilter } }, { session })
      .sort({ enrollmentDate: -1 })
      .toArray();
  }

  async getAllExisitingEnrollments(session?: ClientSession) {
    await this.init();
    return await this.enrollmentCollection.find({}, { session }).toArray();
  }

  async getCourseVersionEnrollments(
    courseId: string,
    courseVersionId: string,
    skip: number,
    limit: number,
    search: string,
    sortBy: 'name' | 'enrollmentDate' | 'progress',
    sortOrder: 'asc' | 'desc',
    filter: string,
    session?: ClientSession,
  ) {
    await this.init();
    const matchStage: any = {
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(courseVersionId),
    };
    if (filter) {
      if (filter === 'STUDENT') {
        matchStage.role = 'STUDENT';
      } else if (filter === 'OTHER') {
        matchStage.role = { $ne: 'STUDENT' };
      }
    }


    // decide sort field
    let sortField: any = {};
    if (sortBy === 'name') {
      // sort by firstName + lastName
      sortField = {
        firstName: sortOrder === 'asc' ? 1 : -1,
        lastName: sortOrder === 'asc' ? 1 : -1,
      };
    } else if (sortBy === 'enrollmentDate') {
      sortField = { enrollmentDate: sortOrder === 'asc' ? 1 : -1 };
    } else if (sortBy === 'progress') {
      sortField = { percentCompleted: sortOrder === 'asc' ? 1 : -1 };
    }

    const aggregationPipeline: any[] = [
      { $match: matchStage },
      {
        $addFields: {
          userId: { $toObjectId: '$userId' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userInfo',
        },
      },
      { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          userId: { $toString: '$userInfo._id' },
          _id: { $toString: '$_id' },
          courseId: { $toString: '$courseId' },
          courseVersionId: { $toString: '$courseVersionId' },
          firstName: '$userInfo.firstName',
          lastName: '$userInfo.lastName',
          email: '$userInfo.email',
        },
      },
    ];

    // search
    if (search && search.trim() !== '') {
      aggregationPipeline.push({
        $match: {
          $or: [
            { 'userInfo.firstName': { $regex: search, $options: 'i' } },
            { 'userInfo.email': { $regex: search, $options: 'i' } },
          ],
        },
      });
    }

    // sorting
    aggregationPipeline.push({ $sort: sortField });

    // pagination
    aggregationPipeline.push({ $skip: skip }, { $limit: limit });

    // count separately
    const totalDocuments = await this.enrollmentCollection.countDocuments(
      matchStage,
    );
    const enrollments = await this.enrollmentCollection
      .aggregate(aggregationPipeline, { session })
      .toArray();

    const totalPages =
      typeof limit === 'number' && limit > 0
        ? Math.ceil(totalDocuments / limit)
        : 1;

    return {
      totalDocuments,
      totalPages,
      currentPage: Math.floor(skip / limit) + 1,
      enrollments,
    };
  }

  async getVersionEnrollmentStats(
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<EnrollmentStats> {
    const [result] = await this.enrollmentCollection
      .aggregate<{
        totalEnrollments: number;
        completedCount: number;
        averageProgressPercent: number;
      }>(
        [
          {
            $match: {
              courseId: new ObjectId(courseId),
              courseVersionId: new ObjectId(courseVersionId),
              role: "STUDENT",
            },
          },
          {
            $group: {
              _id: null,
              totalEnrollments: { $sum: 1 },
              completedCount: {
                $sum: {
                  $cond: [{ $gte: ['$percentCompleted', 100] }, 1, 0],
                },
              },
              totalProgress: {
                $sum: {
                  $multiply: [{ $ifNull: ['$percentCompleted', 0] }, 1],
                },
              },
            },
          },
          {
            $project: {
              _id: 0,
              totalEnrollments: 1,
              completedCount: 1,
              averageProgressPercent: {
                $cond: [
                  { $gt: ['$totalEnrollments', 0] },
                  {
                    $round: [
                      { $divide: ['$totalProgress', '$totalEnrollments'] },
                      1,
                    ],
                  },
                  0,
                ],
              },
            },
          },
        ],
        { session },
      )
      .toArray();

    return (
      result || {
        totalEnrollments: 0,
        completedCount: 0,
        averageProgressPercent: 0,
      }
    );
  }

  /**
   * Count total enrollments for a user
   */
  async countEnrollments(userId: string, role: EnrollmentRole) {
    await this.init();

    const userObjectid = new ObjectId(userId);;

    return await this.enrollmentCollection.countDocuments({
      userId: userObjectid,
      role,
    });
  }
  /*Update enrollments for all records in db */
  async bulkUpdateEnrollments(
    bulkOperations: any[],
    session?: ClientSession,
  ): Promise<void> {
    await this.init();
    try {
      const result = await this.enrollmentCollection.bulkWrite(bulkOperations, {
        session,
      });
      console.log(`Enrollment bulk update result: ${JSON.stringify(result)}`);
    } catch (error) {
      throw new InternalServerError(
        'Failed to bulk update enrollments.\n More Details: ' + error,
      );
    }
  }

  async addEnrollmentIndexes(session?: ClientSession): Promise<void> {
    try {
      await this.enrollmentCollection.dropIndex('courseVersionId_1');
      await this.enrollmentCollection.dropIndex('courseId_1');
      await this.enrollmentCollection.dropIndex('enrollmentDate_-1');

      await this.enrollmentCollection.createIndex(
        { courseId: 1, courseVersionId: 1 },
        { name: 'courseId_1_courseVersionId_1' },
      );
      // await this.enrollmentCollection.createIndex({ userId: 1, role: 1 });
      // await this.enrollmentCollection.createIndex({ courseId: 1 });
      // await this.enrollmentCollection.createIndex({ courseVersionId: 1 });
      // await this.enrollmentCollection.createIndex({ enrollmentDate: -1 });

      console.log('Indexes created successfully!');
    } catch (err) {
      console.log(err);
    }
  }

  async getByCourseVersion(
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<any[]> {
    await this.init();
    return this.enrollmentCollection
      .find(
        {
          courseId: new ObjectId(courseId),
          courseVersionId: new ObjectId(courseVersionId),
        },
        { session },
      )
      .toArray();
  }

  /* Update progress percentage for array of users */
  async bulkUpdateProgressPercents(
    updates: { enrollmentId: string; percentCompleted: number }[],
    session?: ClientSession,
  ): Promise<void> {
    if (!updates.length) return;

    const operations = updates.map(update => ({
      updateOne: {
        filter: { _id: new ObjectId(update.enrollmentId) },
        update: { $set: { progressPercent: update.percentCompleted } },
      },
    }));

    await this.enrollmentCollection.bulkWrite(operations, { session });
  }

  /**
   * Retrieves quiz IDs organized by modules and sections for a given course version
   * @param versionId - The ID of the course version
   * @returns Array of modules with their sections and associated quiz IDs
   * @throws {NotFoundError} If course version is not found
   * @throws {InternalServerError} For database operation failures
   */
  async getQuizIdsByModulesAndSections(
    versionId: string
  ): Promise<Array<{
    moduleId: string;
    moduleName: string;
    sections: Array<{
      sectionId: string;
      sectionName: string;
      quizIds: string[];
    }>;
  }>> {
    if (!ObjectId.isValid(versionId)) {
      throw new Error('Invalid version ID format');
    }

    await this.init();

    try {
      // 1. Get the course version with modules and sections
      const courseVersion = await this.courseVersionCollection.findOne(
        { _id: new ObjectId(versionId) },
        {
          projection: {
            'modules.moduleId': 1,
            'modules.name': 1,
            'modules.sections.sectionId': 1,
            'modules.sections.name': 1,
            'modules.sections.itemsGroupId': 1
          }
        }
      );

      if (!courseVersion) {
        throw new NotFoundError(`Course version ${versionId} not found`);
      }

      if (!courseVersion?.modules?.length) {
        return [];
      }

      // 2. Extract all itemsGroupIds for sections
      const sectionsWithItems = courseVersion.modules.flatMap(module =>
        module.sections?.map(section => ({
          moduleId: module.moduleId,
          moduleName: module.name || 'Unnamed Module',
          sectionId: section.sectionId,
          sectionName: section.name || 'Unnamed Section',
          itemsGroupId: section.itemsGroupId
        })) || []
      ).filter(section => section.itemsGroupId);

      if (sectionsWithItems.length === 0) {
        return [];
      }

      // 3. Get all itemsGroups in one query
      const itemsGroupIds = sectionsWithItems.map(s => new ObjectId(s.itemsGroupId));
      const itemsGroups = await this.itemsGroupCollection.find(
        { _id: { $in: itemsGroupIds } }
      ).toArray();

      // 4. Create a map of itemsGroupId to its quiz items
      const itemsGroupMap = new Map();
      itemsGroups.forEach(group => {
        const quizItems = (group.items || [])
          .filter(item => item.type === 'QUIZ')
          .map(item => item._id.toString());
        itemsGroupMap.set(group._id.toString(), quizItems);
      });

      // 5. Structure the result by module and section
      const result = [];
      const moduleMap = new Map();

      for (const section of sectionsWithItems) {
        const quizIds = itemsGroupMap.get(section.itemsGroupId) || [];
        if (quizIds.length === 0) continue;

        let moduleData = moduleMap.get(section.moduleId);
        if (!moduleData) {
          moduleData = {
            moduleId: section.moduleId,
            moduleName: section.moduleName,
            sections: []
          };
          moduleMap.set(section.moduleId, moduleData);
          result.push(moduleData);
        }

        moduleData.sections.push({
          sectionId: section.sectionId,
          sectionName: section.sectionName,
          quizIds
        });
      }

      return result;
    }
    catch (error) {
      console.error('Error in getQuizIdsByModulesAndSections:', error);
      throw error;
    }
  }



  /**
   * Get quiz details by their IDs
   * @param quizIds Array of quiz IDs
   * @returns Map of quizId to quiz details
   */
  private async getQuizDetails(quizIds: ObjectId[]): Promise<Map<string, { name: string }>> {

    const quizzes = await this.quizCollection
      .find({
        _id: { $in: quizIds }
      })
      .project({
        _id: 1,
        name: 1
      })
      .toArray();

    const quizDetails = new Map<string, { name: string }>();
    quizzes.forEach(quiz => {
      quizDetails.set(quiz._id.toString(), {
        name: quiz.name
      });
    });

    return quizDetails;
  }

  private processIds = (ids: (string | ObjectId)[]) => {
    return ids.map(id =>
      typeof id === 'string' && ObjectId.isValid(id)
        ? new ObjectId(id)
        : id
    );
  };

  /**
   * Get maximum scores for a list of quizzes
   * @param userIds Array of user IDs (can be string or ObjectId)
   * @param quizIds Array of quiz IDs (can be string or ObjectId)
   * @returns Nested map of userId -> quizId -> maxScore
   */
  private async getMaxScoresForQuizzes(
    userIds: (string | ObjectId)[],
    quizIds: (string | ObjectId)[]
  ): Promise<Map<string, Map<string, number>>> {
    if (!quizIds.length) return new Map<string, Map<string, number>>();

    try {
      // Handle both string and ObjectId inputs


      const ObjuserIds = this.processIds(userIds);
      const ObjquizIds = this.processIds(quizIds);

      const results = await this.submissionCollection.aggregate([
        {
          $match: {
            userId: { $in: ObjuserIds },
            quizId: { $in: ObjquizIds },
            'gradingResult.totalMaxScore': { $exists: true },
            'gradingResult.totalScore': { $exists: true }
          }
        },
        {
          $project: {
            userId: 1,
            quizId: 1,
            score: { $ifNull: ['$gradingResult.totalScore', 0] },
            maxPossibleScore: { $ifNull: ['$gradingResult.totalMaxScore', 0] }
          }
        },
        {
          $group: {
            _id: {
              userId: '$userId',
              quizId: '$quizId'
            },
            bestScore: { $max: '$score' },
            maxPossibleScore: { $first: '$maxPossibleScore' } // Assuming maxPossibleScore is same for all attempts
          }
        },
        {
          $project: {
            _id: 0,
            userId: '$_id.userId',
            quizId: '$_id.quizId',
            bestScore: 1,  // Keep the best score
            maxPossibleScore: 1,  // Keep the max possible score
            scorePercentage: {
              $let: {
                vars: {
                  percentage: {
                    $cond: [
                      { $eq: ['$maxPossibleScore', 0] },
                      0,
                      {
                        $multiply: [
                          { $divide: ['$bestScore', '$maxPossibleScore'] },
                          100
                        ]
                      }
                    ]
                  }
                },
                in: {
                  $cond: [
                    { $eq: [{ $mod: ['$$percentage', 1] }, 0] },
                    '$$percentage',
                    { $round: ['$$percentage', 2] }
                  ]
                }
              }
            }
          }
        }
      ]).toArray();

      // Convert to Map<userId, Map<quizId, scorePercentage>>
      const maxScores = new Map<string, Map<string, number>>();

      results.forEach(result => {

        const userId = result.userId?.toString();
        const quizId = result.quizId?.toString();

        if (userId && quizId) {
          if (!maxScores.has(userId)) {
            maxScores.set(userId, new Map<string, number>());
          }
          maxScores.get(userId)?.set(quizId, result.scorePercentage);
        }
      });
      return maxScores;
    }
    catch (error) {
      console.error('Error in getMaxScoresForQuizzes:', error);
    }
  }

  /**
   * Get number of attempts per user per quiz
   * @param userIds Array of user IDs (can be string or ObjectId)
   * @param quizIds Array of quiz IDs (can be string or ObjectId)
   * @returns Nested object mapping userId -> quizId -> attemptCount
   */
  private async getUserQuizAttempts(
    userIds: (string | ObjectId)[],
    quizIds: (string | ObjectId)[]
  ): Promise<Map<string, Map<string, number>>> {
    if (!userIds.length || !quizIds.length) return new Map<string, Map<string, number>>();

    try {
      const result = new Map<string, Map<string, number>>();

      // Process users in batches to avoid too many database queries
      const BATCH_SIZE = 1000;
      for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
        const batch = userIds.slice(i, i + BATCH_SIZE);

        for (const userId of batch) {
          const userMap = new Map<string, number>();
          const userIdStr = userId.toString();

          for (const quizId of quizIds) {
            const quizIdStr = quizId.toString();

            const count = await this.attemptRepository.countUserAttempts(
              quizIdStr,
              userIdStr
            ) || 0;

            userMap.set(quizIdStr, count);
          }

          result.set(userIdStr, userMap);
        }
      }
      console.log("results from total attempmts from enrollment repository", result);

      return result;
    } catch (error) {
      console.error('Error in getUserQuizAttempts:', error);
      throw error;
    }
  }

  /**
   * Get quiz scores for all students in a course version
   * @param courseId Course ID
   * @param versionId Course version ID
   * @returns Array of student quiz scores with their max scores and attempts
   */

  private readonly BATCH_SIZE = 1000; // Number of students to process in each batch

  async getQuizScoresForCourseVersion(
    courseId: string,
    versionId: string,
  ): Promise<QuizScoresExportResponseDto> {
    const startTime = Date.now();
    await this.init();

    if (!this.enrollmentCollection || !this.submissionCollection || !this.quizCollection) {
      throw new Error('Database collections not properly initialized');
    }

    try {
      // 1. First get total count for batching
      const totalStudents = await this.enrollmentCollection.countDocuments({
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(versionId),
        role: 'STUDENT',
        status: { $regex: /^active$/i } // strict, case-insensitive
      });


      if (totalStudents === 0) {
        return {
          data: [],
          metadata: {
            courseId,
            versionId,
            totalStudents: 0,
            durationMs: 0,
            generatedAt: new Date().toISOString()
          }
        };
      }

      // 2. Get all quizzes organized by modules and sections once
      const quizzesByModuleSection = await this.getQuizIdsByModulesAndSections(versionId);
      const allQuizIds = [...new Set(quizzesByModuleSection.flatMap(module =>
        module.sections.flatMap(section => section.quizIds)
      ))];

      if (allQuizIds.length === 0) {
        return {
          data: [],
          metadata: {
            courseId,
            versionId,
            totalStudents: 0,
            durationMs: 0,
            generatedAt: new Date().toISOString()
          }
        };
      }

      const quizIdsObjectIds = allQuizIds.map(id => new ObjectId(id));
      const quizDetails = await this.getQuizDetails(quizIdsObjectIds);

      // 3. Process students in batches
      const result: StudentQuizScoreDto[] = [];
      const totalBatches = Math.ceil(totalStudents / this.BATCH_SIZE);

      for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
        const skip = batchNum * this.BATCH_SIZE;

        // 4. Get batch of enrollments with user details
        const enrollments = await this.enrollmentCollection.aggregate([
          {
            $match: {
              courseId: new ObjectId(courseId),
              courseVersionId: new ObjectId(versionId),
              role: 'STUDENT',
              status: { $regex: /^active$/i }
            }
          },
          { $skip: skip },
          { $limit: this.BATCH_SIZE },
          {
            $lookup: {
              from: 'users',
              localField: 'userId',
              foreignField: '_id',
              as: 'user',
            }
          },
          { $unwind: '$user' },
          {
            $project: {
              _id: 1,
              userId: 1,
              'user.firstName': 1,
              'user.lastName': 1,
              'user.email': 1
            }
          }
        ]).toArray();

        if (enrollments.length === 0) continue;

        const batchUserIds = enrollments.map(e => e.userId);

        // 5. Fetch max scores and attempts for this batch
        const [maxScores, totalAttempts] = await Promise.all([
          this.getMaxScoresForQuizzes(batchUserIds, quizIdsObjectIds),
          this.getUserQuizAttempts(batchUserIds, quizIdsObjectIds)
        ]);

        // 6. Process this batch
        const batchResults = enrollments.map(enrollment => {
          const userId = enrollment.userId.toString();

          const quizScores = quizzesByModuleSection.flatMap(module =>
            module.sections.flatMap(section =>
              section.quizIds.map(quizId => {
                const detail = quizDetails.get(quizId);
                return {
                  moduleId: module.moduleId,
                  sectionId: section.sectionId,
                  quizId,
                  quizName: detail?.name || 'Untitled Quiz',
                  maxScore: maxScores.get(userId)?.get(quizId) || 0,
                  attempts: totalAttempts.get(userId)?.get(quizId) || 0
                };
              })
            )
          );

          return {
            studentId: userId,
            name: `${enrollment.user?.firstName || ''} ${enrollment.user?.lastName || ''}`.trim() || 'Unknown',
            email: enrollment.user?.email || '',
            quizScores
          };
        });

        result.push(...batchResults);
      }

      const duration = Date.now() - startTime;
      return {
        data: result,
        metadata: {
          courseId,
          versionId,
          totalStudents: result.length,
          durationMs: duration,
          generatedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Error in getQuizScoresForCourseVersion:', error);
      throw new Error('Failed to fetch quiz scores');
    }
  }
}
