import {
  EnrollmentRole,
  EnrollmentStatus,
  IEnrollment,
  IProgress,
  ICourseVersion,
  IWatchTime,
  IUser,
  ID,
} from '#shared/interfaces/models.js';
import {injectable, inject} from 'inversify';
import {ClientSession, Collection, ObjectId, OptionalId} from 'mongodb';
import {InternalServerError, NotFoundError} from 'routing-controllers';
import {MongoDatabase} from '../MongoDatabase.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {EnrollmentStats} from '#root/modules/users/types.js';
import {
  StudentQuizScoreDto,
  QuizScoresExportResponseDto,
} from '#root/modules/users/dtos/QuizScoresExportDto.js';
import {
  IAttempt,
  ISubmission,
} from '#root/modules/quizzes/interfaces/grading.js';
import {ItemsGroup, QuizItem} from '#root/modules/courses/classes/index.js';
import {AttemptRepository} from '#root/modules/quizzes/repositories/index.js';
import {QUIZZES_TYPES} from '#root/modules/quizzes/types.js';
import {IQuestionBank} from '#root/shared/interfaces/quiz.js';

@injectable()
export class EnrollmentRepository {
  private enrollmentCollection!: Collection<IEnrollment>;
  private progressCollection!: Collection<IProgress>;
  private courseVersionCollection!: Collection<ICourseVersion>;
  private watchTimeCollection!: Collection<IWatchTime>;
  private submissionCollection!: Collection<ISubmission>;
  private attemptCollection!: Collection<IAttempt>;
  private quizCollection!: Collection<QuizItem>;
  private itemsGroupCollection!: Collection<ItemsGroup>;
  private questionBankCollection!: Collection<IQuestionBank>;
  private initialized = false;

  constructor(
    @inject(QUIZZES_TYPES.AttemptRepo)
    private attemptRepository: AttemptRepository,
    @inject(GLOBAL_TYPES.Database) private db: MongoDatabase,
  ) {}

  private async init() {
    // initialize only once
    if (this.initialized) {
      return;
    }
    this.initialized = true;

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
    this.quizCollection = await this.db.getCollection<QuizItem>('quizzes');
    this.itemsGroupCollection = await this.db.getCollection<ItemsGroup>(
      'itemsGroup',
    );
    this.attemptCollection = await this.db.getCollection<IAttempt>(
      'quiz_attempts',
    );
    this.questionBankCollection = await this.db.getCollection<IQuestionBank>(
      'questionBanks',
    );

    // High-priority indexes for read performance
    // Using background: true to avoid blocking operations
    try {
      await this.enrollmentCollection.createIndex(
        {userId: 1, courseId: 1, courseVersionId: 1},
        {
          unique: true,
          name: 'userId_1_courseId_1_courseVersionId_1_unique',
          background: true,
        },
      );
    } catch (e) {
      // Index already exists
    }

    try {
      await this.enrollmentCollection.createIndex(
        {userId: 1, role: 1},
        {name: 'userId_1_role_1', background: true},
      );
    } catch (e) {
      // Index already exists
    }

    try {
      await this.enrollmentCollection.createIndex(
        {courseId: 1, courseVersionId: 1, role: 1, status: 1},
        {
          name: 'courseId_1_courseVersionId_1_role_1_status_1',
          background: true,
        },
      );
    } catch (e) {
      // Index already exists
    }

    try {
      await this.progressCollection.createIndex(
        {userId: 1, courseId: 1, courseVersionId: 1},
        {name: 'userId_1_courseId_1_courseVersionId_1', background: true},
      );
    } catch (e) {
      // Index already exists
    }

    try {
      await this.watchTimeCollection.createIndex(
        {userId: 1, courseId: 1, courseVersionId: 1},
        {name: 'userId_1_courseId_1_courseVersionId_1', background: true},
      );
    } catch (e) {
      // Index already exists
    }
  }

  /**
   * Find an enrollment by ID
   */
  async findById(id: string): Promise<IEnrollment | null> {
    await this.init();
    try {
      return await this.enrollmentCollection.findOne({_id: new ObjectId(id)});
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
      {session},
    );
  }

  async findActiveEnrollment(
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
        status: 'ACTIVE',
        isDeleted: {$ne: true},
      },
      {session},
    );
  }

  async getInstructorIdsByVersion(
    courseId: string,
    versionId: string,
    session?: ClientSession,
  ) {
    await this.init();

    const enrollments = await this.enrollmentCollection
      .find(
        {
          courseId: new ObjectId(courseId),
          courseVersionId: new ObjectId(versionId),
          role: 'INSTRUCTOR',
          status: 'ACTIVE',
        },
        {projection: {userId: 1, _id: 0}, session}, // only return userId
      )
      .toArray();
    return enrollments.map(enrollment => enrollment.userId);
  }

  async updateProgressPercentById(
    enrollmentId: string,
    percentCompleted: number,
    session?: ClientSession,
    completedItemsCount?: number,
  ): Promise<void> {
    try {
      await this.init();
      const update: any = {percentCompleted};
      if (typeof completedItemsCount === 'number') {
        update.completedItemsCount = completedItemsCount;
      }

      await this.enrollmentCollection.findOneAndUpdate(
        {_id: new ObjectId(enrollmentId)},
        {$set: update},
        {session},
      );
    } catch (error) {
      throw new InternalServerError(
        `Failed to update progress in enrollment. More/${error}`,
      );
    }
  }

  async updateCompletedItemsCount(
    enrollmentId: string,
    completedItemsCount: number,
    session?: ClientSession,
  ): Promise<void> {
    try {
      await this.init();
      await this.enrollmentCollection.findOneAndUpdate(
        {_id: new ObjectId(enrollmentId)},
        {$set: {completedItemsCount, updatedAt: new Date()}},
        {session},
      );
    } catch (error) {
      throw new InternalServerError(
        `Failed to update completed items count in enrollment. More/${error}`,
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
        {session},
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

  async deleteEnrollment(
    userId: string,
    courseId: string,
    courseVersionId: string,
    session?: any,
  ): Promise<void> {
    await this.init();

    const courseObjectId = new ObjectId(courseId);
    const courseVersionObjectId = new ObjectId(courseVersionId);

    const userFilter = [
      userId,
      ObjectId.isValid(userId) ? new ObjectId(userId) : null,
    ].filter(Boolean);

    const result = await this.enrollmentCollection.updateOne(
      {
        userId: {$in: userFilter},
        courseId: courseObjectId,
        courseVersionId: courseVersionObjectId,
      },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          status: 'INACTIVE',
          unenrolledAt: new Date(),
        },
      },
      {session},
    );
    if (result.modifiedCount === 0) {
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
        {session},
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
    await this.progressCollection.updateMany(
      {
        userId: new ObjectId(userId),
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
      },
      {$set: {isDeleted: true, deletedAt: new Date()}},
      {session},
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
        {
          $match: {
            userId: userObjectId,
            role,
            isDeleted: {$ne: true},
            status: 'ACTIVE',
          },
        },
        {$sort: {enrollmentDate: -1}},
        {$skip: skip},
        {$limit: limit},
        {
          $lookup: {
            from: 'newCourse',
            localField: 'courseId',
            foreignField: '_id',
            as: 'course',
            pipeline: [{$project: {name: 1, versions: 1}}],
          },
        },
        {$unwind: {path: '$course', preserveNullAndEmptyArrays: true}},
        // Lookup content counts (optimized)
        {
          $lookup: {
            from: 'newCourseVersion',
            let: {versionId: '$courseVersionId'},
            pipeline: [
              {$match: {$expr: {$eq: ['$_id', '$$versionId']}}},
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
                      in: {$concatArrays: ['$$value', '$$this']},
                    },
                  },
                },
              },
              {$unwind: '$itemGroupIds'},
              {
                $addFields: {
                  itemGroupObjId: {$toObjectId: '$itemGroupIds'},
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
              {$unwind: '$itemsGroup'},
              {$unwind: '$itemsGroup.items'},
              {
                $group: {
                  _id: '$_id',
                  totalItems: {$sum: 1},
                  videos: {
                    $sum: {
                      $cond: [{$eq: ['$itemsGroup.items.type', 'VIDEO']}, 1, 0],
                    },
                  },
                  quizzes: {
                    $sum: {
                      $cond: [{$eq: ['$itemsGroup.items.type', 'QUIZ']}, 1, 0],
                    },
                  },
                  articles: {
                    $sum: {
                      $cond: [
                        {$eq: ['$itemsGroup.items.type', 'ARTICLE']},
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
                {$arrayElemAt: ['$contentCounts', 0]},
                {totalItems: 0, videos: 0, quizzes: 0, articles: 0},
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
                      {$eq: ['$userId', '$$userId']},
                      {$eq: ['$courseId', '$$courseId']},
                      {$eq: ['$courseVersionId', '$$courseVersionId']},
                    ],
                  },
                },
              },
              {
                $group: {
                  _id: null,
                  distinctItemIds: {$addToSet: '$itemId'},
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
                  {$arrayElemAt: ['$watchedItems.distinctItemIds', 0]},
                  [],
                ],
              },
            },
          },
        },
        {$unset: 'watchedItems'},
        // Only add search filter if search is provided
        ...(search && search.trim()
          ? [{$match: {'course.name': {$regex: search, $options: 'i'}}}]
          : []),
        // Project only required fields
        {
          $project: {
            _id: {$toString: '$_id'},
            courseId: {$toString: '$courseId'},
            courseVersionId: {$toString: '$courseVersionId'},
            role: 1,
            status: 1,
            enrollmentDate: 1,
            course: 1,
            percentCompleted: {$ifNull: ['$percentCompleted', 0]},
            contentCounts: 1,
            watchedItemCount: 1,
          },
        },
      ];

      return await this.enrollmentCollection
        .aggregate(aggregationPipeline, {session})
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
  ) {
    await this.init();
    const userObjectId = new ObjectId(userId);
    const pipeline: any[] = [
      {
        $match: {
          userId: userObjectId,
          role,
          isDeleted: {$ne: true},
          status: 'ACTIVE',
        },
      },

      {$sort: {enrollmentDate: -1}},

      /* ---------------- COURSE LOOKUP ---------------- */
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
                description: 1,
                updatedAt: 1,
              },
            },
          ],
        },
      },
      {$unwind: '$course'},

      /* ---------------- COURSE VERSION LOOKUP (NEW) ---------------- */
      {
        $lookup: {
          from: 'newCourseVersion',
          localField: 'courseVersionId',
          foreignField: '_id',
          as: 'courseVersion',
          pipeline: [
            {
              $project: {
                totalItems: 1,
                itemCounts: 1,
              },
            },
          ],
        },
      },

      {$unwind: {path: '$courseVersion', preserveNullAndEmptyArrays: true}},
      {$skip: skip},
      {$limit: limit},
      /* ---------------- SEARCH ---------------- */
      ...(search?.trim()
        ? [{$match: {'course.name': {$regex: search, $options: 'i'}}}]
        : []),

      /* ---------------- FINAL SHAPE ---------------- */
      {
        $project: {
          _id: 1,
          courseId: 1,
          courseVersionId: 1,
          role: 1,
          status: 1,
          enrollmentDate: 1,
          course: 1,

          // 🔥 pulled from courseVersion
          totalItems: {$ifNull: ['$courseVersion.totalItems', 0]},
          itemCounts: {$ifNull: ['$courseVersion.itemCounts', {}]},

          percentCompleted: {$ifNull: ['$percentCompleted', 0]},
        },
      },
    ];

    /*const pipeline: any[] = [
      {$match: {userId: userObjectId, role}},
      {$sort: {enrollmentDate: -1}},
      {$skip: skip},
      {$limit: limit},
      {
        $lookup: {
          from: 'newCourse',
          localField: 'courseId',
          foreignField: '_id',
          as: 'course',
          pipeline: [
            {$match: {versions: {$exists: true, $ne: []}}},
            {
              $lookup: {
                from: 'newCourseVersion',
                let: {versionIds: '$versions'},
                pipeline: [
                  {
                    $match: {
                      $expr: {$in: ['$_id', '$$versionIds']},
                      isDeleted: {$ne: true},
                    },
                  },
                ],
                as: 'versionDetails',
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: '$course',
          preserveNullAndEmptyArrays: true,
        },
      },
      // Use versionDetails to populate the versions array
      {
        $addFields: {
          'course.versions': {
            $map: {
              input: '$course.versionDetails',
              as: 'v',
              in: {$toString: '$$v._id'},
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          userId: 1,
          courseId: 1,
          courseVersionId: 1,
          role: 1,
          status: 1,
          enrollmentDate: 1,
          percentCompleted: 1,
          course: 1,
        },
      },
    ];*/

    const enrollments = await this.enrollmentCollection
      .aggregate(pipeline)
      .toArray();

    return enrollments;
  }

  async getBasicInstructorEnrollments(
    userId: string,
    skip: number,
    limit: number,
    role: EnrollmentRole,
    search?: string,
  ) {
    await this.init();

    const pipeline: any[] = [
      /* ---------- EARLY FILTER (INDEXED) ---------- */
      {
        $match: {
          userId: new ObjectId(userId),
          role,
          isDeleted: {$ne: true},
          status: 'ACTIVE',
        },
      },

      {$sort: {enrollmentDate: -1}},
      {$skip: skip},
      {$limit: limit},

      /* ---------- COURSE LOOKUP (OPTIMIZED) ---------- */
      {
        $lookup: {
          from: 'newCourse',
          let: {courseId: '$courseId'},
          pipeline: [
            {
              $match: {
                $expr: {$eq: ['$_id', '$$courseId']},
                ...(search?.trim()
                  ? {name: {$regex: search, $options: 'i'}}
                  : {}),
              },
            },

            /* keep only required fields */
            {
              $project: {
                name: 1,
                description: 1,
                updatedAt: 1,
                versions: 1,
              },
            },

            /* filter non-deleted versions */
            {
              $lookup: {
                from: 'newCourseVersion',
                localField: 'versions',
                foreignField: '_id',
                as: 'versions',
                pipeline: [
                  {$match: {isDeleted: {$ne: true}}},
                  {$project: {_id: 1}},
                ],
              },
            },

            {
              $project: {
                name: 1,
                description: 1,
                updatedAt: 1,
                versions: {
                  $map: {
                    input: '$versions',
                    as: 'v',
                    in: {$toString: '$$v._id'},
                  },
                },
              },
            },
          ],
          as: 'course',
        },
      },

      /* ---------- REMOVE NON-MATCHED COURSES ---------- */
      {$unwind: '$course'},

      /* ---------- FINAL SHAPE ---------- */
      {
        $project: {
          _id: 1,
          courseId: 1,
          courseVersionId: 1,
          role: 1,
          status: 1,
          enrollmentDate: 1,
          course: 1,
        },
      },
    ];

    return this.enrollmentCollection.aggregate(pipeline).toArray();
  }

  async getContentCountsForVersions(
    versionIds: ObjectId[],
  ): Promise<Map<string, any>> {
    const results = await this.courseVersionCollection
      .aggregate([
        {$match: {_id: {$in: versionIds}}},
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
                in: {$concatArrays: ['$$value', '$$this']},
              },
            },
          },
        },
        {$unwind: '$itemGroupIds'},
        {
          $addFields: {
            itemGroupObjId: {$toObjectId: '$itemGroupIds'},
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
        {$unwind: '$itemsGroup'},
        {$match: {'itemsGroup.isHidden': {$ne: true}}},

        {$unwind: '$itemsGroup.items'},
        {
          $addFields: {
            itemObjId: {$toObjectId: '$itemsGroup.items._id'},
          },
        },
        {
          $lookup: {
            from: 'videos',
            let: {itemId: '$itemObjId', itemType: '$itemsGroup.items.type'},
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {$eq: ['$_id', '$$itemId']},
                      {$eq: ['$$itemType', 'VIDEO']},
                    ],
                  },
                },
              },
              {$project: {isDeleted: 1, isHidden: 1}},
            ],
            as: 'videoDoc',
          },
        },
        {
          $lookup: {
            from: 'blogs',
            let: {itemId: '$itemObjId', itemType: '$itemsGroup.items.type'},
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {$eq: ['$_id', '$$itemId']},
                      {$eq: ['$$itemType', 'BLOG']},
                    ],
                  },
                },
              },
              {$project: {isDeleted: 1, isHidden: 1}},
            ],
            as: 'blogDoc',
          },
        },
        {
          $lookup: {
            from: 'quizzes',
            let: {itemId: '$itemObjId', itemType: '$itemsGroup.items.type'},
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {$eq: ['$_id', '$$itemId']},
                      {$eq: ['$$itemType', 'QUIZ']},
                    ],
                  },
                },
              },
              {$project: {isDeleted: 1, isHidden: 1}},
            ],
            as: 'quizDoc',
          },
        },
        {
          $lookup: {
            from: 'projects',
            let: {itemId: '$itemObjId', itemType: '$itemsGroup.items.type'},
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {$eq: ['$_id', '$$itemId']},
                      {$eq: ['$$itemType', 'PROJECT']},
                    ],
                  },
                },
              },
              {$project: {isDeleted: 1, isHidden: 1}},
            ],
            as: 'projectDoc',
          },
        },
        {
          $addFields: {
            isItemDeleted: {
              $switch: {
                branches: [
                  {
                    case: {$eq: ['$itemsGroup.items.type', 'VIDEO']},
                    then: {
                      $ifNull: [
                        {$arrayElemAt: ['$videoDoc.isDeleted', 0]},
                        false,
                      ],
                    },
                  },
                  {
                    case: {$eq: ['$itemsGroup.items.type', 'BLOG']},
                    then: {
                      $ifNull: [
                        {$arrayElemAt: ['$blogDoc.isDeleted', 0]},
                        false,
                      ],
                    },
                  },
                  {
                    case: {$eq: ['$itemsGroup.items.type', 'QUIZ']},
                    then: {
                      $ifNull: [
                        {$arrayElemAt: ['$quizDoc.isDeleted', 0]},
                        false,
                      ],
                    },
                  },
                  {
                    case: {$eq: ['$itemsGroup.items.type', 'PROJECT']},
                    then: {
                      $ifNull: [
                        {$arrayElemAt: ['$projectDoc.isDeleted', 0]},
                        false,
                      ],
                    },
                  },
                ],
                default: false,
              },
            },
            isItemHidden: {
              $switch: {
                branches: [
                  {
                    case: {$eq: ['$itemsGroup.items.type', 'VIDEO']},
                    then: {
                      $ifNull: [
                        {$arrayElemAt: ['$videoDoc.isHidden', 0]},
                        false,
                      ],
                    },
                  },
                  {
                    case: {$eq: ['$itemsGroup.items.type', 'BLOG']},
                    then: {
                      $ifNull: [
                        {$arrayElemAt: ['$blogDoc.isHidden', 0]},
                        false,
                      ],
                    },
                  },
                  {
                    case: {$eq: ['$itemsGroup.items.type', 'QUIZ']},
                    then: {
                      $ifNull: [
                        {$arrayElemAt: ['$quizDoc.isHidden', 0]},
                        false,
                      ],
                    },
                  },
                  {
                    case: {$eq: ['$itemsGroup.items.type', 'PROJECT']},
                    then: {
                      $ifNull: [
                        {$arrayElemAt: ['$projectDoc.isHidden', 0]},
                        false,
                      ],
                    },
                  },
                ],
                default: false,
              },
            },
          },
        },
        {$match: {isItemDeleted: {$ne: true}}},
        {$match: {isItemHidden: {$ne: true}}},
        {
          $group: {
            _id: '$_id',
            totalItems: {$sum: 1},
            videos: {
              $sum: {
                $cond: [{$eq: ['$itemsGroup.items.type', 'VIDEO']}, 1, 0],
              },
            },
            quizzes: {
              $sum: {
                $cond: [{$eq: ['$itemsGroup.items.type', 'QUIZ']}, 1, 0],
              },
            },
            articles: {
              $sum: {
                $cond: [{$eq: ['$itemsGroup.items.type', 'BLOG']}, 1, 0],
              },
            },
            project: {
              $sum: {
                $cond: [{$eq: ['$itemsGroup.items.type', 'PROJECT']}, 1, 0],
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
        project: doc.project,
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
      isHidden: {$ne: true},
    }));

    const results = await this.watchTimeCollection
      .aggregate([
        {$match: {$or: matchConditions}},
        {
          $group: {
            _id: {
              userId: '$userId',
              courseId: '$courseId',
              courseVersionId: '$courseVersionId',
            },
            itemIds: {$addToSet: '$itemId'},
          },
        },
        {
          $project: {
            _id: 1,
            count: {$size: '$itemIds'},
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
      .find({userId: {$in: userFilter}, isDeleted: {$ne: true}}, {session})
      .sort({enrollmentDate: -1})
      .toArray();
  }

  async getAllExisitingEnrollments(session?: ClientSession) {
    await this.init();
    return await this.enrollmentCollection.find({}, {session}).toArray();
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
      status: {$regex: /^active$/i},
      isDeleted: {$ne: true}, // Exclude soft-deleted enrollments
    };
    if (filter) {
      if (filter === 'STUDENT') {
        matchStage.role = 'STUDENT';
      } else if (filter === 'OTHER') {
        matchStage.role = {$ne: 'STUDENT'};
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
      sortField = {enrollmentDate: sortOrder === 'asc' ? 1 : -1};
    } else if (sortBy === 'progress') {
      sortField = {percentCompleted: sortOrder === 'asc' ? 1 : -1};
    }

    const aggregationPipeline: any[] = [
      {$match: matchStage},
      {
        $addFields: {
          userId: {$toObjectId: '$userId'},
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
      {$unwind: {path: '$userInfo', preserveNullAndEmptyArrays: true}},
      {
        $addFields: {
          userId: {$toString: '$userInfo._id'},
          _id: {$toString: '$_id'},
          courseId: {$toString: '$courseId'},
          courseVersionId: {$toString: '$courseVersionId'},
          firstName: '$userInfo.firstName',
          lastName: '$userInfo.lastName',
          email: '$userInfo.email',
          completedItemsCount: {$ifNull: ['$completedItemsCount', 0]},
        },
      },
    ];

    // search
    if (search && search.trim() !== '') {
      const searchTerm = search.trim();
      aggregationPipeline.push({
        $match: {
          $or: [
            {'userInfo.firstName': {$regex: search, $options: 'i'}},
            {'userInfo.email': {$regex: search, $options: 'i'}},
            {firstName: {$regex: searchTerm, $options: 'i'}},
            {lastName: {$regex: searchTerm, $options: 'i'}},
            {email: {$regex: searchTerm, $options: 'i'}},
          ],
        },
      });
    }

    // Get the total count with search applied
    const countPipeline = [...aggregationPipeline, {$count: 'total'}];
    const countResult = await this.enrollmentCollection
      .aggregate<{total: number}>(countPipeline, {session})
      .next();
    const totalDocuments = countResult?.total || 0;

    // sorting
    aggregationPipeline.push({$sort: sortField});

    // pagination
    aggregationPipeline.push({$skip: skip}, {$limit: limit});

    // count separately
    // const totalDocuments = await this.enrollmentCollection.countDocuments(
    //   matchStage,
    // );

    const enrollments = await this.enrollmentCollection
      .aggregate(aggregationPipeline, {session})
      .toArray();

    const totalPages = limit > 0 ? Math.ceil(totalDocuments / limit) : 1;

    return {
      totalDocuments,
      totalPages,
      currentPage: limit > 0 ? Math.floor(skip / limit) + 1 : 1,
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
              role: 'STUDENT',
              status: {$regex: /^active$/i},
              isDeleted: {$ne: true}, // Exclude soft-deleted enrollments
            },
          },
          {
            $group: {
              _id: null,
              totalEnrollments: {$sum: 1},
              completedCount: {
                $sum: {
                  $cond: [{$gte: ['$percentCompleted', 100]}, 1, 0],
                },
              },
              totalProgress: {
                $sum: {
                  $multiply: [{$ifNull: ['$percentCompleted', 0]}, 1],
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
                  {$gt: ['$totalEnrollments', 0]},
                  {
                    $round: [
                      {$divide: ['$totalProgress', '$totalEnrollments']},
                      1,
                    ],
                  },
                  0,
                ],
              },
            },
          },
        ],
        {session},
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
      isDeleted: {$ne: true},
      status: 'ACTIVE',
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

  async getEnrollmentsByFilters(filters: {
    courseId?: string;
    courseVersionId?: string;
    userId?: string;
  }) {
    await this.init();

    const query: any = {
      isDeleted: {$ne: true},
      status: 'ACTIVE',
    };

    if (filters.courseId) query.courseId = new ObjectId(filters.courseId);

    if (filters.courseVersionId)
      query.courseVersionId = new ObjectId(filters.courseVersionId);

    if (filters.userId) query.userId = new ObjectId(filters.userId);

    return this.enrollmentCollection.find(query).toArray();
  }

  async addEnrollmentIndexes(session?: ClientSession): Promise<void> {
    try {
      await this.enrollmentCollection.dropIndex('courseVersionId_1');
      await this.enrollmentCollection.dropIndex('courseId_1');
      await this.enrollmentCollection.dropIndex('enrollmentDate_-1');

      await this.enrollmentCollection.createIndex(
        {courseId: 1, courseVersionId: 1},
        {name: 'courseId_1_courseVersionId_1'},
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

  //new method to get instructors
  //   async getInstructorIdsByVersion(courseId:string, versionId:strin) {
  //   const enrollments = await this.enrollmentCollection.find({
  //     courseId,
  //     courseVersionId: versionId,
  //     role: 'INSTRUCTOR',
  //     status: 'ACTIVE'
  //   }).select('userId').lean();
  //   return enrollments.map(enrollment => enrollment.userId);
  // }

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
        {session},
      )
      .toArray();
  }

  /* Update progress percentage for array of users */
  async bulkUpdateProgressPercents(
    updates: {enrollmentId: string; percentCompleted: number}[],
    session?: ClientSession,
  ): Promise<void> {
    if (!updates.length) return;

    const operations = updates.map(update => ({
      updateOne: {
        filter: {_id: new ObjectId(update.enrollmentId)},
        update: {$set: {progressPercent: update.percentCompleted}},
      },
    }));

    await this.enrollmentCollection.bulkWrite(operations, {session});
  }

  private async processCompletedItemsBatch(
    enrollments: any[],
    session?: ClientSession,
  ): Promise<number> {
    if (enrollments.length === 0) return 0;

    const enrollmentMap = new Map<string, any>();

    enrollments.forEach(e => {
      enrollmentMap.set(
        `${e.userId}_${e.courseId}_${e.courseVersionId}`,
        e._id,
      );
    });

    // 🔥 Single aggregation for entire batch
    const completedCounts = await this.watchTimeCollection
      .aggregate(
        [
          {
            $match: {
              isDeleted: {$ne: true},
              $or: enrollments.map(e => ({
                userId: e.userId,
                courseId: e.courseId,
                courseVersionId: e.courseVersionId,
              })),
            },
          },
          {
            $group: {
              _id: {
                userId: '$userId',
                courseId: '$courseId',
                courseVersionId: '$courseVersionId',
              },
              completedItemsCount: {$addToSet: '$itemId'},
            },
          },
          {
            $project: {
              completedItemsCount: {$size: '$completedItemsCount'},
            },
          },
        ],
        {session},
      )
      .toArray();

    const operations = completedCounts.map(c => {
      const key = `${c._id.userId}_${c._id.courseId}_${c._id.courseVersionId}`;
      const enrollmentId = enrollmentMap.get(key);

      return {
        updateOne: {
          filter: {_id: enrollmentId},
          update: {
            $set: {
              completedItemsCount: c.completedItemsCount,
              updatedAt: new Date(),
            },
          },
        },
      };
    });

    if (operations.length === 0) return 0;

    const result = await this.enrollmentCollection.bulkWrite(operations, {
      session,
    });

    return result.modifiedCount;
  }

  /* Update completed items count for all enrollments in batches of 100 */
  async bulkUpdateCompletedItemsCountForCourseVersion(
    filters: {
      courseVersionId: string;
      courseId?: string;
      userId?: string;
    },
    session?: ClientSession,
  ): Promise<{totalCount: number; updatedCount: number}> {
    await this.init();

    const BATCH_SIZE = 500;
    let totalCount = 0;
    let updatedCount = 0;

    const match: any = {
      isDeleted: {$ne: true},
      courseVersionId: new ObjectId(filters.courseVersionId),
    };

    if (filters.courseId) {
      match.courseId = new ObjectId(filters.courseId);
    }

    if (filters.userId) {
      match.userId = new ObjectId(filters.userId);
    }

    const cursor = this.enrollmentCollection
      .find(match)
      .project({userId: 1, courseId: 1, courseVersionId: 1})
      .batchSize(BATCH_SIZE);

    let batch: any[] = [];

    for await (const enrollment of cursor) {
      batch.push(enrollment);
      totalCount++;

      if (batch.length === BATCH_SIZE) {
        updatedCount += await this.processCompletedItemsBatch(batch, session);
        batch = [];
      }
    }

    if (batch.length > 0) {
      updatedCount += await this.processCompletedItemsBatch(batch, session);
    }

    console.log(
      `✅ CourseVersion ${filters.courseVersionId} → scanned=${totalCount}, updated=${updatedCount}`,
    );

    return {totalCount, updatedCount};
  }

  /**
   * Retrieves quiz IDs organized by modules and sections for a given course version

  /**
   * Get quiz details by their IDs
   * @param quizIds Array of quiz IDs
   * @returns Map of quizId to quiz details
   */
  private async getQuizDetails(
    quizIds: ObjectId[],
  ): Promise<Map<string, {name: string}>> {
    const quizzes = await this.quizCollection
      .find({
        _id: {$in: quizIds},
      })
      .project({
        _id: 1,
        name: 1,
      })
      .toArray();

    const quizDetails = new Map<string, {name: string}>();
    quizzes.forEach(quiz => {
      quizDetails.set(quiz._id.toString(), {
        name: quiz.name,
      });
    });

    return quizDetails;
  }

  /**
   * Get maximum scores and individual question scores for a list of quizzes (Optimized for large datasets)
   * @param userIds Array of user IDs (can be string or ObjectId)
   * @param quizIds Array of quiz IDs (can be string or ObjectId)
   * @returns Object containing:
   *   - maxScores: Nested map of userId -> quizId -> maxScore
   *   - questionScores: Nested map of userId -> quizId -> questionId -> score
   */
  private async getMaxScoresForQuizzes(
    userIds: (string | ObjectId)[],
    quizIds: (string | ObjectId)[],
  ): Promise<{
    maxScores: Map<string, Map<string, number>>;
    questionScores: Map<string, Map<string, Map<string, number>>>;
  }> {
    if (!quizIds.length || !userIds.length) {
      return {
        maxScores: new Map<string, Map<string, number>>(),
        questionScores: new Map<string, Map<string, Map<string, number>>>(),
      };
    }

    try {
      // Handle both string and ObjectId inputs
      // Process incoming IDs into both string and ObjectId versions
      // 🔄 Convert IDs into both ObjectId[] and string[] for mixed-type matching
      const ObjuserIds = userIds
        .filter(
          id =>
            (typeof id === 'string' && ObjectId.isValid(id)) ||
            id instanceof ObjectId,
        )
        .map(id => (typeof id === 'string' ? new ObjectId(id) : id));

      const ObjquizIds = quizIds
        .filter(
          id =>
            (typeof id === 'string' && ObjectId.isValid(id)) ||
            id instanceof ObjectId,
        )
        .map(id => (typeof id === 'string' ? new ObjectId(id) : id));

      const stringUserIds = userIds.map(id => id.toString());
      const stringQuizIds = quizIds.map(id => id.toString());

      // Optimized: Use aggregation to get max scores as percentages in a single pass
      const maxScoreResults = await this.submissionCollection
        .aggregate([
          {
            $match: {
              $and: [
                {
                  $or: [
                    {userId: {$in: ObjuserIds}},
                    {userId: {$in: stringUserIds}},
                  ],
                },
                {
                  $or: [
                    {quizId: {$in: ObjquizIds}},
                    {quizId: {$in: stringQuizIds}},
                  ],
                },
                {'gradingResult.totalMaxScore': {$exists: true}},
                {'gradingResult.totalScore': {$exists: true}},
              ],
            },
          },
          {
            $project: {
              userId: 1,
              quizId: 1,
              score: {$ifNull: ['$gradingResult.totalScore', 0]},
              maxPossibleScore: {$ifNull: ['$gradingResult.totalMaxScore', 0]},
            },
          },
          {
            $group: {
              _id: {
                userId: '$userId',
                quizId: '$quizId',
              },
              bestScore: {$max: '$score'},
              maxPossibleScore: {$first: '$maxPossibleScore'},
            },
          },
          {
            $project: {
              _id: 0,
              userId: {$toString: '$_id.userId'},
              quizId: {$toString: '$_id.quizId'},
              bestScore: 1,
              maxPossibleScore: 1,
              scorePercentage: {
                $let: {
                  vars: {
                    percentage: {
                      $cond: [
                        {$eq: ['$maxPossibleScore', 0]},
                        0,
                        {
                          $multiply: [
                            {$divide: ['$bestScore', '$maxPossibleScore']},
                            100,
                          ],
                        },
                      ],
                    },
                  },
                  in: {
                    $cond: [
                      {$eq: [{$mod: ['$$percentage', 1]}, 0]},
                      '$$percentage',
                      {$round: ['$$percentage', 2]},
                    ],
                  },
                },
              },
            },
          },
        ])
        .toArray();

      // Optimized: Get question-level scores in a separate efficient query
      const questionScoreResults = await this.submissionCollection
        .find({
          $and: [
            {
              $or: [
                {userId: {$in: ObjuserIds}},
                {userId: {$in: stringUserIds}},
              ],
            },
            {
              $or: [
                {quizId: {$in: ObjquizIds}},
                {quizId: {$in: stringQuizIds}},
              ],
            },
            {'gradingResult.overallFeedback': {$exists: true, $ne: []}},
          ],
        })
        .project({
          userId: 1,
          quizId: 1,
          'gradingResult.overallFeedback': 1,
        })
        .toArray();

      // Build result maps efficiently
      const maxScores = new Map<string, Map<string, number>>();
      const questionScores = new Map<
        string,
        Map<string, Map<string, number>>
      >();

      // Process max scores (now as percentages)
      maxScoreResults.forEach(result => {
        const {userId, quizId, maxScorePercentage} = result;
        if (!maxScores.has(userId)) {
          maxScores.set(userId, new Map<string, number>());
        }
        maxScores.get(userId)?.set(quizId, maxScorePercentage);
      });

      // Process question scores
      questionScoreResults.forEach(attempt => {
        const userId = attempt.userId?.toString();
        const quizId = attempt.quizId?.toString();

        if (!userId || !quizId || !attempt.gradingResult?.overallFeedback) {
          return;
        }

        // Initialize maps if they don't exist
        if (!questionScores.has(userId)) {
          questionScores.set(userId, new Map<string, Map<string, number>>());
        }
        if (!questionScores.get(userId)?.has(quizId)) {
          questionScores.get(userId)?.set(quizId, new Map<string, number>());
        }

        const userQuizQuestions = questionScores.get(userId)?.get(quizId);
        if (userQuizQuestions && attempt.gradingResult?.overallFeedback) {
          attempt.gradingResult.overallFeedback.forEach((feedback: any) => {
            if (!feedback.questionId || typeof feedback.score !== 'number') {
              return;
            }

            const questionId = feedback.questionId.toString();
            const currentQuestionScore = userQuizQuestions.get(questionId) || 0;

            // Store the maximum score for each question
            if (feedback.score > currentQuestionScore) {
              userQuizQuestions.set(questionId, feedback.score);
            }
          });
        }
      });

      return {maxScores, questionScores};
    } catch (error) {
      console.error('Error in getMaxScoresForQuizzes:', error);
      return {
        maxScores: new Map<string, Map<string, number>>(),
        questionScores: new Map<string, Map<string, Map<string, number>>>(),
      };
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
    quizIds: (string | ObjectId)[],
  ): Promise<Map<string, Map<string, number>>> {
    if (!userIds.length || !quizIds.length) return new Map();

    try {
      const ObjUserIds = userIds.map(id => new ObjectId(id.toString()));
      const ObjQuizIds = quizIds.map(id => new ObjectId(id.toString()));

      const results = await this.attemptCollection
        .aggregate([
          {
            $match: {
              userId: {$in: ObjUserIds},
              quizId: {$in: ObjQuizIds},
            },
          },
          {
            $group: {
              _id: {userId: '$userId', quizId: '$quizId'},
              attemptCount: {$sum: 1},
            },
          },
          {
            $project: {
              _id: 0,
              userId: {$toString: '$_id.userId'},
              quizId: {$toString: '$_id.quizId'},
              attemptCount: 1,
            },
          },
        ])
        .toArray();

      const attemptMap = new Map<string, Map<string, number>>();
      for (const {userId, quizId, attemptCount} of results) {
        if (!attemptMap.has(userId)) {
          attemptMap.set(userId, new Map());
        }
        attemptMap.get(userId)!.set(quizId, attemptCount);
      }

      return attemptMap;
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

  private readonly BATCH_SIZE = 500; // Increased from 100 to 500 for better performance

  /**
   * Get all question IDs for multiple quizzes in bulk (optimized for large datasets)
   * @param quizIds Array of quiz IDs
   * @returns Map of quizId to array of question IDs
   */
  private async getQuizQuestionIdsBulk(
    quizIds: string[],
  ): Promise<Map<string, string[]>> {
    await this.init();

    if (!quizIds.length) {
      return new Map();
    }

    try {
      /** ------------------------------------
       * 1️⃣ Fetch quizzes
       * ------------------------------------ */
      const quizzes = await this.quizCollection
        .find({
          _id: {$in: quizIds.map(id => new ObjectId(id))},
          'details.questionBankRefs': {$exists: true, $ne: []},
        })
        .project({
          _id: 1,
          'details.questionBankRefs.bankId': 1,
        })
        .toArray();

      /** ------------------------------------
       * 2️⃣ Collect unique bank IDs
       * ------------------------------------ */
      const bankIds = new Set<string>();

      for (const quiz of quizzes) {
        for (const ref of quiz.details?.questionBankRefs ?? []) {
          if (ObjectId.isValid(ref.bankId)) {
            bankIds.add(ref.bankId.toString());
          }
        }
      }

      if (!bankIds.size) {
        return new Map(quizIds.map(id => [id, []]));
      }

      /** ------------------------------------
       * 3️⃣ Fetch question banks
       * ------------------------------------ */
      const questionBanks = await this.questionBankCollection
        .find({
          _id: {$in: [...bankIds].map(id => new ObjectId(id))},
        })
        .project({_id: 1, questions: 1})
        .toArray();

      /** ------------------------------------
       * 4️⃣ Build bank → questions map
       * ------------------------------------ */
      const bankQuestionsMap = new Map<string, string[]>();

      for (const bank of questionBanks) {
        bankQuestionsMap.set(
          bank._id.toString(),
          (bank.questions ?? []).map(q => q.toString()),
        );
      }

      /** ------------------------------------
       * 5️⃣ Build quiz → questions map
       * ------------------------------------ */
      const quizQuestionsMap = new Map<string, string[]>();

      for (const quiz of quizzes) {
        const qId = quiz._id.toString();
        const questionSet = new Set<string>();

        for (const ref of quiz.details?.questionBankRefs ?? []) {
          const questions = bankQuestionsMap.get(ref.bankId?.toString());
          if (questions) {
            for (const q of questions) questionSet.add(q);
          }
        }

        quizQuestionsMap.set(qId, [...questionSet]);
      }

      /** ------------------------------------
       * 6️⃣ Ensure all quiz IDs exist
       * ------------------------------------ */
      for (const quizId of quizIds) {
        if (!quizQuestionsMap.has(quizId)) {
          quizQuestionsMap.set(quizId, []);
        }
      }

      return quizQuestionsMap;
    } catch (error) {
      console.error('Error in getQuizQuestionIdsBulk:', error);
      return new Map(quizIds.map(id => [id, []]));
    }
  }

  /**
   * Get all question IDs for a quiz by fetching from question banks
   * @param quizId The quiz ID to get questions for
   * @returns Array of question IDs
   */
  private async getQuizQuestionIds(quizId: string): Promise<string[]> {
    await this.init();

    const quiz = await this.quizCollection.findOne({_id: new ObjectId(quizId)});
    if (!quiz || !quiz.details?.questionBankRefs?.length) {
      return [];
    }

    // Get all question bank IDs
    const bankIds = quiz.details.questionBankRefs
      .filter((ref: any) => ref.bankId && ObjectId.isValid(ref.bankId))
      .map((ref: any) => new ObjectId(ref.bankId));

    if (bankIds.length === 0) {
      return [];
    }

    // Get all questions from the question banks
    const questionBanks = await this.questionBankCollection
      .find({_id: {$in: bankIds}})
      .toArray();

    // Extract all question IDs
    const questionIds = new Set<string>();
    for (const bank of questionBanks) {
      if (bank.questions?.length) {
        bank.questions.forEach((q: any) => {
          if (q) {
            questionIds.add(q.toString());
          }
        });
      }
    }

    return Array.from(questionIds);
  }

  /**
   * Retrieves quiz IDs organized by modules and sections for a given course version
   * @param versionId The ID of the course version
   * @returns Array of modules with their sections and associated quiz IDs
   */
  async getQuizIdsByModulesAndSections(versionId: string): Promise<
    Array<{
      moduleId: string;
      moduleName: string;
      sections: Array<{
        sectionId: string;
        sectionName: string;
        quizIds: string[];
      }>;
    }>
  > {
    // Define types for the data we're working with
    type QuizDocument = {_id: ObjectId; itemsGroupId: string};
    type ModuleSection = {
      sectionId: string;
      name: string;
      itemsGroupId: string;
    };
    type Module = {moduleId: string; name: string; sections: ModuleSection[]};
    await this.init();

    if (!ObjectId.isValid(versionId)) {
      throw new Error('Invalid version ID format');
    }

    try {
      // 1. Get the course version with modules and sections
      const courseVersion = await this.courseVersionCollection.findOne(
        {_id: new ObjectId(versionId)},
        {
          projection: {
            'modules.moduleId': 1,
            'modules.name': 1,
            'modules.sections.sectionId': 1,
            'modules.sections.name': 1,
            'modules.sections.itemsGroupId': 1,
          },
        },
      );

      if (!courseVersion || !courseVersion.modules) {
        return [];
      }

      // 2. Get all items groups for the sections
      const sectionItemsGroupIds = courseVersion.modules
        .flatMap(module => {
          return (module.sections || []).map(section => {
            return section.itemsGroupId;
          });
        })
        .filter(Boolean);

      if (sectionItemsGroupIds.length === 0) {
        console.warn(
          `[WARN] No valid item group IDs found in course version ${versionId}`,
        );
        return [];
      }

      // 3. Get all items groups that contain quizzes
      const itemsGroups = await this.itemsGroupCollection
        .find({
          _id: {$in: sectionItemsGroupIds.map(id => new ObjectId(id))},
        })
        .toArray();

      // Get all quiz items from these groups
      const quizItems = itemsGroups.flatMap(group => {
        const groupId = group._id?.toString();

        const filteredItems =
          group.items
            ?.filter(item => {
              const isQuiz = item.type === 'QUIZ';
              return isQuiz;
            })
            .map(item => ({
              _id: item._id?.toString(),
              itemsGroupId: groupId,
            })) || [];

        return filteredItems;
      });

      // 4. Organize quiz items by itemsGroupId for quick lookup
      const quizzesByItemsGroup = new Map<string, string[]>();

      quizItems.forEach((quiz, index) => {
        if (!quiz.itemsGroupId) {
          console.warn(
            `[WARN] Quiz item at index ${index} has no itemsGroupId:`,
            quiz,
          );
          return;
        }
        if (!quiz._id) {
          console.warn(
            `[WARN] Quiz item in group ${quiz.itemsGroupId} has no _id`,
          );
          return;
        }

        if (!quizzesByItemsGroup.has(quiz.itemsGroupId)) {
          quizzesByItemsGroup.set(quiz.itemsGroupId, []);
        }
        quizzesByItemsGroup.get(quiz.itemsGroupId)?.push(quiz._id);
      });

      // 5. Build the result structure
      const result = (
        courseVersion.modules ||
        ([] as Array<{
          moduleId: string;
          name?: string;
          sections?: ModuleSection[];
        }>)
      )
        .map(module => {
          const moduleSections = (module.sections || [])
            .filter(
              (section): section is ModuleSection & {itemsGroupId: string} => {
                if (!section || !section.itemsGroupId) {
                  return false;
                }

                const sectionGroupId = section.itemsGroupId.toString();
                const hasQuizzes = quizzesByItemsGroup.has(sectionGroupId);

                return hasQuizzes;
              },
            )
            .map(section => {
              const sectionGroupId = section.itemsGroupId.toString();
              const quizIds = quizzesByItemsGroup.get(sectionGroupId) || [];

              return {
                sectionId: section.sectionId.toString(),
                sectionName: section.name || 'Unnamed Section',
                quizIds: quizIds,
              };
            })
            .filter(section => section.quizIds.length > 0);

          const moduleResult = {
            moduleId: module.moduleId,
            moduleName: module.name || 'Unnamed Module',
            sections: moduleSections,
          };

          return moduleResult;
        })
        .filter(module => module.sections.length > 0);

      return result;
    } catch (error) {
      console.error(`[ERROR] Error in getQuizIdsByModulesAndSections:`, error);
      throw error;
    }
  }

  async getQuizScoresForCourseVersion(
    courseId: string,
    versionId: string,
  ): Promise<QuizScoresExportResponseDto> {
    const startTime = Date.now();
    await this.init();

    if (!this.enrollmentCollection || !this.submissionCollection) {
      throw new Error('Database collections not properly initialized');
    }

    if (!ObjectId.isValid(courseId) || !ObjectId.isValid(versionId)) {
      throw new Error('Invalid course or version ID');
    }

    const courseIdObj = new ObjectId(courseId);
    const versionIdObj = new ObjectId(versionId);

    const studentFilter = {
      courseId: courseIdObj,
      courseVersionId: versionIdObj,
      role: 'STUDENT' as EnrollmentRole,
      status: {$regex: /^active$/i},
    };

    /* -------------------------------------------------------
     * 1️⃣ FETCH ENROLLMENTS (ONCE)
     * ----------------------------------------------------- */
    const enrollments = await this.enrollmentCollection
      .aggregate([
        {$match: studentFilter},
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        {$unwind: '$user'},
        {
          $project: {
            userId: 1,
            'user.firstName': 1,
            'user.lastName': 1,
            'user.email': 1,
          },
        },
      ])
      .toArray();

    if (!enrollments.length) {
      return {
        data: [],
        metadata: {
          courseId,
          versionId,
          totalStudents: 0,
          durationMs: Date.now() - startTime,
          generatedAt: new Date().toISOString(),
        },
      };
    }

    const userIds = enrollments.map(e => e.userId);

    /* -------------------------------------------------------
     * 2️⃣ FETCH QUIZ STRUCTURE
     * ----------------------------------------------------- */
    const quizzesByModuleSection = await this.getQuizIdsByModulesAndSections(
      versionId,
    );

    const validQuizIds = [
      ...new Set(
        quizzesByModuleSection.flatMap(m =>
          m.sections.flatMap(s => s.quizIds.filter(id => ObjectId.isValid(id))),
        ),
      ),
    ];

    if (!validQuizIds.length) {
      return {
        data: [],
        metadata: {
          courseId,
          versionId,
          totalStudents: enrollments.length,
          durationMs: Date.now() - startTime,
          generatedAt: new Date().toISOString(),
        },
      };
    }

    const quizIdsObj = validQuizIds.map(id => new ObjectId(id));

    const [quizDetails, quizQuestionsMap] = await Promise.all([
      this.getQuizDetails(quizIdsObj),
      this.getQuizQuestionIdsBulk(validQuizIds),
    ]);

    /* -------------------------------------------------------
     * 3️⃣ AGGREGATE SUBMISSIONS IN MONGO (🔥 FIX)
     * ----------------------------------------------------- */
    const aggregatedSubmissions = await this.submissionCollection
      .aggregate([
        {
          $match: {
            userId: {$in: userIds},
            quizId: {$in: quizIdsObj},
          },
        },
        {
          $unwind: '$gradingResult.overallFeedback',
        },
        {
          $group: {
            _id: {
              userId: '$userId',
              quizId: '$quizId',
              questionId: '$gradingResult.overallFeedback.questionId',
            },
            questionScore: {
              $max: '$gradingResult.overallFeedback.score',
            },
            maxScore: {
              $max: '$gradingResult.totalScore',
            },
            attempts: {$sum: 1},
          },
        },
      ])
      .toArray();

    /* -------------------------------------------------------
     * 4️⃣ BUILD FAST LOOKUP MAPS
     * ----------------------------------------------------- */
    const scoreMap = new Map<string, Map<string, Map<string, number>>>();
    const maxScoreMap = new Map<string, Map<string, number>>();
    const attemptsMap = new Map<string, Map<string, number>>();

    for (const row of aggregatedSubmissions) {
      const userId = row._id.userId.toString();
      const quizId = row._id.quizId.toString();
      const questionId = row._id.questionId.toString();

      // attempts
      attemptsMap
        .set(userId, attemptsMap.get(userId) ?? new Map())
        .get(userId)!
        .set(quizId, row.attempts);

      // max score
      maxScoreMap
        .set(userId, maxScoreMap.get(userId) ?? new Map())
        .get(userId)!
        .set(quizId, row.maxScore ?? 0);

      // question score
      scoreMap
        .set(userId, scoreMap.get(userId) ?? new Map())
        .get(userId)!
        .set(quizId, scoreMap.get(userId)?.get(quizId) ?? new Map())
        .get(quizId)!
        .set(questionId, row.questionScore ?? 0);
    }

    /* -------------------------------------------------------
     * 5️⃣ BUILD FINAL RESPONSE (NO DB CALLS)
     * ----------------------------------------------------- */
    const data: StudentQuizScoreDto[] = enrollments.map(enrollment => {
      const userId = enrollment.userId.toString();
      const quizScores: StudentQuizScoreDto['quizScores'] = [];

      for (const module of quizzesByModuleSection) {
        for (const section of module.sections) {
          for (const quizId of section.quizIds) {
            if (!quizQuestionsMap.has(quizId)) continue;

            const questionIds = quizQuestionsMap.get(quizId)!;
            const qScoreMap = scoreMap.get(userId)?.get(quizId) ?? new Map();

            quizScores.push({
              moduleId: module.moduleId,
              sectionId: section.sectionId,
              quizId,
              quizName: quizDetails.get(quizId)?.name ?? 'Untitled Quiz',
              maxScore: maxScoreMap.get(userId)?.get(quizId) ?? 0,
              attempts: attemptsMap.get(userId)?.get(quizId) ?? 0,
              questionScores: questionIds.map(qid => ({
                questionId: qid,
                score: qScoreMap.get(qid) ?? 0,
              })),
            });
          }
        }
      }

      return {
        studentId: userId,
        name:
          `${enrollment.user.firstName ?? ''} ${
            enrollment.user.lastName ?? ''
          }`.trim() || 'Unknown',
        email: enrollment.user.email ?? '',
        quizScores,
      };
    });

    return {
      data,
      metadata: {
        courseId,
        versionId,
        totalStudents: data.length,
        durationMs: Date.now() - startTime,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  async getNonStudentEnrollmentsByCourseVersion(
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<IEnrollment[]> {
    try {
      await this.init();
      const courseObjectId = new ObjectId(courseId);
      const versionObjectId = new ObjectId(courseVersionId);

      const enrollments = await this.enrollmentCollection
        .find({
          courseId: courseObjectId,
          courseVersionId: versionObjectId,
          role: {$ne: 'STUDENT'},
        })
        .toArray();

      return enrollments;
    } catch (error) {
      console.error('Failed to get enrollments:', error);
      throw new Error('Failed to fetch enrollments for the course version');
    }
  }

  async getEnrollmentsByCourseVersion(
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<IEnrollment[]> {
    try {
      await this.init();
      const courseObjectId = new ObjectId(courseId);
      const versionObjectId = new ObjectId(courseVersionId);

      const enrollments = await this.enrollmentCollection
        .find(
          {
            courseId: courseObjectId,
            courseVersionId: versionObjectId,
            role: 'STUDENT',
            status: {$regex: /^active$/i},
          },
          {session},
        )
        .toArray();

      return enrollments;
    } catch (error) {
      console.error('Failed to get student enrollments:', error);
      throw new Error(
        'Failed to fetch student enrollments for the course version',
      );
    }
  }

  async deleteEnrollmentByVersionId(
    versionId: string,
    session?: ClientSession,
  ) {
    try {
      const versionObjectId = new ObjectId(versionId);

      const result = await this.enrollmentCollection.updateMany(
        {
          courseVersionId: versionObjectId,
        },
        {$set: {isDeleted: true, deletedAt: new Date()}},
        {session},
      );

      return result.modifiedCount;
    } catch (error) {
      console.error('Failed to delete enrollments:', error);
      throw new Error('Failed to delete enrollments for the course version');
    }
  }

  async createEnrollments(
    enrollments: OptionalId<IEnrollment>[],
    session?: ClientSession,
  ) {
    if (!enrollments.length) return [];

    const result = await this.enrollmentCollection.insertMany(enrollments, {
      session,
    });
    return result.insertedIds;
  }
  async deleteEnrollmentsByVersionIds(
    versionIds: ObjectId[],
    session?: ClientSession,
  ): Promise<boolean> {
    if (!versionIds.length) return false;

    const result = await this.enrollmentCollection.deleteMany(
      {
        courseVersionId: {$in: versionIds},
      },
      {session},
    );
    return result.acknowledged && result.deletedCount > 0;
  }

  async getUserEnrollmentsByCourseVersion(
    userId: string,
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<IEnrollment> {
    await this.init();
    return await this.enrollmentCollection
      .find(
        {
          userId: new ObjectId(userId),
          courseId: new ObjectId(courseId),
          courseVersionId: new ObjectId(courseVersionId),
        },
        {session},
      )
      .next();
  }

  async setWatchTimeVisibility(
    itemIds: string[],
    isHidden: boolean,
    session?: ClientSession,
  ): Promise<boolean> {
    await this.init();

    const itemObjIds = itemIds.map(id => new ObjectId(id));

    const result = await this.watchTimeCollection.updateMany(
      {itemId: {$in: itemObjIds}},
      {$set: {isHidden: isHidden}},
      {session},
    );

    if (!result.acknowledged) {
      throw new InternalServerError(
        'Failed to update watch time visibility for items.',
      );
    }

    return result.modifiedCount > 0;
  }

  /**
   * Get quiz submission grades for multiple users and quizzes (batch operation)
   * Used to enrich enrollment data with quiz scores
   * Gets the best (max score) submission for each user-quiz combination
   */
  async getBatchQuizSubmissionGrades(
    userIds: string[],
    quizIds: string[],
    session?: ClientSession,
  ): Promise<ISubmission[]> {
    await this.init();

    if (!userIds.length || !quizIds.length) {
      return [];
    }

    const userObjectIds = userIds.map(id => new ObjectId(id));
    const quizObjectIds = quizIds.map(id => new ObjectId(id));

    // Get the best (max score) submission for each user-quiz combination
    return await this.submissionCollection
      .aggregate<ISubmission>(
        [
          {
            $match: {
              userId: {$in: userObjectIds},
              quizId: {$in: quizObjectIds},
              'gradingResult.totalScore': {$exists: true},
            },
          },
          // Sort by score descending to get best score first
          {
            $sort: {'gradingResult.totalScore': -1},
          },
          // Group by user and quiz, take the first (best) submission
          {
            $group: {
              _id: {
                userId: '$userId',
                quizId: '$quizId',
              },
              submission: {$first: '$$ROOT'},
            },
          },
          // Replace root to get back the submission document
          {
            $replaceRoot: {newRoot: '$submission'},
          },
          // Project only needed fields
          {
            $project: {
              userId: 1,
              quizId: 1,
              'gradingResult.totalScore': 1,
              'gradingResult.totalMaxScore': 1,
            },
          },
        ],
        {session},
      )
      .toArray();
  }

  async getQuizSubmissionGrade(
    userId: string,
    quizIds: string[],
    session?: ClientSession,
  ): Promise<ISubmission[]> {
    await this.init();

    const userObjectId = new ObjectId(userId);
    const quizObjectIds = quizIds.map(id => new ObjectId(id));

    const submission = await this.submissionCollection
      .find(
        {
          userId: userObjectId,
          quizId: {$in: quizObjectIds},
        },
        {
          session,
          projection: {
            quizId: 1,
            'gradingResult.totalScore': 1,
            'gradingResult.totalMaxScore': 1,
            _id: 0, // Exclude _id if not needed
          },
        },
      )
      .toArray();

    return submission;
  }
}
