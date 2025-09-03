import {
  EnrollmentRole,
  IEnrollment,
  IProgress,
  ICourseVersion,
  IWatchTime,
} from '#shared/interfaces/models.js';
import { IAttempt, IUserQuizMetrics, ISubmission } from '#quizzes/interfaces/grading.js';
import { injectable, inject } from 'inversify';
import { ClientSession, Collection, ObjectId } from 'mongodb';
import { InternalServerError, NotFoundError } from 'routing-controllers';
import { MongoDatabase } from '../MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { EnrollmentStats } from '#root/modules/users/types.js';

@injectable()
export class EnrollmentRepository {
  private enrollmentCollection!: Collection<IEnrollment>;
  private progressCollection!: Collection<IProgress>;
  private courseVersionCollection!: Collection<ICourseVersion>;
  private watchTimeCollection!: Collection<IWatchTime>;
  private attemptCollection!: Collection<IAttempt>;
  private userQuizMetricsCollection!: Collection<IUserQuizMetrics>;
  private submissionResultCollection!: Collection<ISubmission>;

  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) { }

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
    this.attemptCollection = await this.db.getCollection<IAttempt>(
      'quiz_attempts',
    );
    this.userQuizMetricsCollection = await this.db.getCollection<IUserQuizMetrics>(
      'user_quiz_metrics',
    );
    this.submissionResultCollection = await this.db.getCollection<ISubmission>(
      'quiz_submission_results',
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
      throw new InternalServerError(
        `Failed to find enrollment by ID: ${error.message}`,
      );
    }
  }

  /**
   * Find an existing enrollment for a user in a specific course version
   */
  async findEnrollment(
    userId: string | ObjectId,
    courseId: string,
    courseVersionId: string,
  ): Promise<IEnrollment | null> {
    await this.init();

    const courseObjectId = new ObjectId(courseId);
    const courseVersionObjectId = new ObjectId(courseVersionId);

    const userObjectid = new ObjectId(userId)

    return await this.enrollmentCollection.findOne({
      userId: userObjectid,
      courseId: courseObjectId,
      courseVersionId: courseVersionObjectId,
    });
  }

  async updateProgressPercentById(
    enrollmentId: string,
    percentCompleted: number,
    session?: ClientSession,
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
        `Failed to update progress in enrollment. More/${error}`,
      );
    }
  }
  /**
   * Create a new enrollment record
   */
  async createEnrollment(enrollment: IEnrollment): Promise<IEnrollment> {
    await this.init();
    try {
      const result = await this.enrollmentCollection.insertOne(enrollment);
      if (!result.acknowledged) {
        throw new InternalServerError('Failed to create enrollment record');
      }

      const newEnrollment = await this.enrollmentCollection.findOne({
        _id: result.insertedId,
      });

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

  // Remove enrollment and all related data (progress, watch time, quiz attempts, quiz metrics, quiz submissions)

  async deleteEnrollment(
    userId: string,
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.init();

    const userObjectId = new ObjectId(userId);
    const courseObjectId = new ObjectId(courseId);
    const courseVersionObjectId = new ObjectId(courseVersionId);

    const userFilter = [
      userId,
      ObjectId.isValid(userId) ? userObjectId : null,
    ].filter(Boolean);

    try {
      // Delete enrollment, Delete progress, watch time, quiz attempts, user quiz metris, quiz submission results
      const enrollmentResult = await this.enrollmentCollection.deleteOne(
        {
          userId: { $in: userFilter },
          courseId: courseObjectId,
          courseVersionId: courseVersionObjectId,
        },
        { session },
      );

      if (enrollmentResult.deletedCount === 0) {
        throw new NotFoundError('Enrollment not found to delete');
      }

      await this.progressCollection.deleteMany(
        {
          userId: { $in: userFilter },
          courseId: courseObjectId,
          courseVersionId: courseVersionObjectId,
        },
        { session },
      );

      await this.watchTimeCollection.deleteMany(
        {
          userId: { $in: userFilter },
          courseId: courseObjectId,
          courseVersionId: courseVersionObjectId,
        },
        { session },
      );

      await this.attemptCollection.deleteMany(
        {
          userId: { $in: userFilter },
          courseId: courseObjectId,
          courseVersionId: courseVersionObjectId,
        },
        { session },
      );

      await this.userQuizMetricsCollection.deleteMany(
        {
          userId: { $in: userFilter },
          courseId: courseObjectId,
          courseVersionId: courseVersionObjectId,
        },
        { session },
      );

      await this.submissionResultCollection.deleteMany(
        {
          userId: { $in: userFilter },
          courseId: courseObjectId,
          courseVersionId: courseVersionObjectId,
        },
        { session },
      );

    } catch (error) {
      throw new InternalServerError(
        `Failed to delete enrollment and related data: ${error.message}`,
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
        throw new InternalServerError('Failed to create progress record');
      }

      const newProgress = await this.progressCollection.findOne({
        _id: result.insertedId,
      });

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

  /**
   * Get paginated enrollments for a user
   */
  //old code
  // async getEnrollments(
  //   userId: string,
  //   skip: number,
  //   limit: number,
  //   search: string,
  //   role: EnrollmentRole,
  //   session?: ClientSession,
  // ) {
  //   try {
  //     await this.init();
  //     const userObjectId = new ObjectId(userId);

  //     const aggregationPipeline: any[] = [
  //       { $match: { userId: userObjectId, role } },
  //       { $sort: { enrollmentDate: -1 } },
  //       { $skip: skip },
  //       { $limit: limit },
  //       {
  //         $lookup: {
  //           from: 'newCourse',
  //           localField: 'courseId',
  //           foreignField: '_id',
  //           as: 'course',
  //           pipeline: [
  //             { $project: { name: 1, versions: 1 } }
  //           ]
  //         },
  //       },
  //       { $unwind: { path: '$course', preserveNullAndEmptyArrays: true } },
  //       {
  //         $addFields: {
  //           'course.versions': {
  //             $map: {
  //               input: '$course.versions',
  //               as: 'v',
  //               in: { $toObjectId: '$$v' },
  //             },
  //           },
  //         },
  //       },
  //       {
  //         $lookup: {
  //           from: 'newCourseVersion',
  //           localField: 'course.versions',
  //           foreignField: '_id',
  //           as: 'course.versionDetails',
  //         },
  //       },
  //       {
  //         $set: {
  //           'course.versionDetails': {
  //             $map: {
  //               input: '$course.versionDetails',
  //               as: 'version',
  //               in: {
  //                 $mergeObjects: [
  //                   '$$version',
  //                   { id: { $toString: '$$version._id' } },
  //                 ],
  //               },
  //             },
  //           },
  //         },
  //       },
  //       {
  //         $unset: 'course.versionDetails._id',
  //       },
  //       {
  //         $set: {
  //           'course.versions': {
  //             $map: {
  //               input: '$course.versions',
  //               as: 'v',
  //               in: { $toString: '$$v' },
  //             },
  //           },
  //         },
  //       },
  //       // Lookup content counts
  //       {
  //         $lookup: {
  //           from: 'newCourseVersion',
  //           let: { versionId: '$courseVersionId' },
  //           pipeline: [
  //             { $match: { $expr: { $eq: ['$_id', '$$versionId'] } } },
  //             {
  //               $project: {
  //                 itemGroupIds: {
  //                   $reduce: {
  //                     input: {
  //                       $map: {
  //                         input: '$modules',
  //                         as: 'm',
  //                         in: {
  //                           $map: {
  //                             input: '$$m.sections',
  //                             as: 's',
  //                             in: '$$s.itemsGroupId',
  //                           },
  //                         },
  //                       },
  //                     },
  //                     initialValue: [],
  //                     in: { $concatArrays: ['$$value', '$$this'] },
  //                   },
  //                 },
  //               },
  //             },

  //             { $unwind: '$itemGroupIds' },
  //             {
  //               $addFields: {
  //                 itemGroupObjId: { $toObjectId: '$itemGroupIds' },
  //               },
  //             },
  //             {
  //               $lookup: {
  //                 from: 'itemsGroup',
  //                 localField: 'itemGroupObjId',
  //                 foreignField: '_id',
  //                 as: 'itemsGroup',
  //               },
  //             },

  //             { $unwind: '$itemsGroup' },
  //             { $unwind: '$itemsGroup.items' },
  //             {
  //               $group: {
  //                 _id: '$_id',
  //                 totalItems: { $sum: 1 },
  //                 videos: {
  //                   $sum: { $cond: [{ $eq: ['$itemsGroup.items.type', 'VIDEO'] }, 1, 0] },
  //                 },
  //                 quizzes: {
  //                   $sum: { $cond: [{ $eq: ['$itemsGroup.items.type', 'QUIZ'] }, 1, 0] },
  //                 },
  //                 articles: {
  //                   $sum: { $cond: [{ $eq: ['$itemsGroup.items.type', 'ARTICLE'] }, 1, 0] },
  //                 },
  //               },
  //             },
  //           ],
  //           as: 'contentCounts',
  //         },
  //       },
  //       {
  //         $set: {
  //           contentCounts: {
  //             $ifNull: [
  //               { $arrayElemAt: ['$contentCounts', 0] },
  //               { totalItems: 0, videos: 0, quizzes: 0, articles: 0 },
  //             ],
  //           },
  //         },
  //       },
  //       //  Lookup watched items
  //       {
  //         $lookup: {
  //           from: 'watchTime',
  //           let: {
  //             userId: '$userId',
  //             courseId: '$courseId',
  //             courseVersionId: '$courseVersionId',
  //           },
  //           pipeline: [
  //             {
  //               $match: {
  //                 $expr: {
  //                   $and: [
  //                     { $eq: ['$userId', '$$userId'] },
  //                     { $eq: ['$courseId', '$$courseId'] },
  //                     { $eq: ['$courseVersionId', '$$courseVersionId'] },
  //                   ],
  //                 },
  //               },
  //             },
  //             {
  //               $group: {
  //                 _id: null,
  //                 distinctItemIds: { $addToSet: '$itemId' },
  //               },
  //             },
  //           ],
  //           as: 'watchedItems',
  //         },
  //       },
  //       {
  //         $set: {
  //           watchedItemCount: {
  //             $size: {
  //               $ifNull: [
  //                 { $arrayElemAt: ['$watchedItems.distinctItemIds', 0] },
  //                 [],
  //               ],
  //             },
  //           },
  //         },
  //       },
  //       {
  //         $unset: 'watchedItems',
  //       }



  //     ];

  //     // Only add search filter if search is provided
  //     if (search && search.trim()) {
  //       aggregationPipeline.push({
  //         $match: { 'course.name': { $regex: search, $options: 'i' } },
  //       });
  //     }



  //     return await this.enrollmentCollection
  //       .aggregate(aggregationPipeline, { session, maxTimeMS: 120000 })
  //       .toArray();
  //   } catch (error) {
  //     console.log(error);
  //     throw new InternalServerError(`Failed to get enrollments /More ${error}`);
  //   }
  // }

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
            pipeline: [
              { $project: { name: 1, versions: 1 } }
            ]
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
                    $sum: { $cond: [{ $eq: ['$itemsGroup.items.type', 'VIDEO'] }, 1, 0] },
                  },
                  quizzes: {
                    $sum: { $cond: [{ $eq: ['$itemsGroup.items.type', 'QUIZ'] }, 1, 0] },
                  },
                  articles: {
                    $sum: { $cond: [{ $eq: ['$itemsGroup.items.type', 'ARTICLE'] }, 1, 0] },
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
    session?: ClientSession,
  ) {
    await this.init();

    const matchStage: any = {
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(courseVersionId),
    };

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

    const userObjectid = new ObjectId(userId);

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

  async addEnrollmentIndexes(
    session?: ClientSession,
  ): Promise<void> {
    try {

      await this.enrollmentCollection.dropIndex("courseVersionId_1")
      await this.enrollmentCollection.dropIndex("courseId_1")
      await this.enrollmentCollection.dropIndex("enrollmentDate_-1")

      await this.enrollmentCollection.createIndex(
        { courseId: 1, courseVersionId: 1 },
        { name: "courseId_1_courseVersionId_1" }
      )
      // await this.enrollmentCollection.createIndex({ userId: 1, role: 1 });
      // await this.enrollmentCollection.createIndex({ courseId: 1 });
      // await this.enrollmentCollection.createIndex({ courseVersionId: 1 });
      // await this.enrollmentCollection.createIndex({ enrollmentDate: -1 });

      console.log('Indexes created successfully!');
    } catch (err) {
      console.log(err)
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

}
