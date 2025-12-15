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
    console.log(
      'CourseId and versionId from getInstructors ',
      courseId,
      versionId,
    );
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
    console.log('enrollments ', enrollments);
    return enrollments.map(enrollment => enrollment.userId);
  }

  async updateProgressPercentById(
    enrollmentId: string,
    percentCompleted: number,
    session?: ClientSession,
  ): Promise<void> {
    try {
      await this.init();
      await this.enrollmentCollection.findOneAndUpdate(
        {_id: new ObjectId(enrollmentId)},
        {$set: {percentCompleted}},
        {session},
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
      console.log('new enrollment ', newEnrollment);
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

    const result = await this.enrollmentCollection.updateOne(
      {
        userId: {$in: userFilter},
        courseId: courseObjectId,
        courseVersionId: courseVersionObjectId,
      },
      {$set: {isDeleted: true, deletedAt: new Date()}},
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
    session?: ClientSession,
  ) {
    await this.init();
    const userObjectId = new ObjectId(userId);
    const pipeline: any[] = [
      {$match: {userId: userObjectId, role, isDeleted: {$ne: true}}},
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
            {$unwind: '$versions'},
            {
              $lookup: {
                from: 'newCourseVersion',
                localField: 'versions',
                foreignField: '_id',
                as: 'versionDetails',
              },
            },
            {
              $match: {
                versionDetails: {
                  $elemMatch: {isDeleted: {$ne: true}},
                },
              },
            },
            {
              $group: {
                _id: '$_id',
                name: {$first: '$name'},
                versions: {$push: '$versions'},
                description: {$first: '$description'},
                updatedAt: {$first: '$updatedAt'},
              },
            },
            {
              $project: {
                name: 1,
                versions: {
                  $map: {
                    input: '$versions',
                    as: 'v',
                    in: {$toString: '$$v'},
                  },
                },
                description: 1,
                updatedAt: 1,
              },
            },
          ],
        },
      },
      {$unwind: {path: '$course', preserveNullAndEmptyArrays: true}},
      ...(search?.trim()
        ? [{$match: {'course.name': {$regex: search, $options: 'i'}}}]
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
      .aggregate(pipeline, {session})
      .toArray();

    return enrollments;
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
<<<<<<< HEAD
              {$project: {isDeleted: 1, isHidden: 1}},
=======
              {$project: {isDeleted: 1}},
>>>>>>> fix/unenroll-users
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
<<<<<<< HEAD
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
=======
>>>>>>> fix/unenroll-users
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
      .find({userId: {$in: userFilter},isDeleted: { $ne: true }}, {session})
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
      // isDeleted: {$ne: true},
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
   * Get maximum scores and individual question scores for a list of quizzes
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
    if (!quizIds.length) {
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

      const results = await this.submissionCollection
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

      // Initialize result maps
      const maxScores = new Map<string, Map<string, number>>();
      const questionScores = new Map<
        string,
        Map<string, Map<string, number>>
      >();

      // First pass: Process all attempts to get max scores and question details
      const allAttempts = await this.submissionCollection
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
        .toArray();

      // Process each attempt to build question scores
      allAttempts.forEach(attempt => {
        const userId = attempt.userId?.toString();
        const quizId = attempt.quizId?.toString();

        if (!userId || !quizId || !attempt.gradingResult?.overallFeedback)
          return;

        // Initialize user and quiz in the questionScores map
        if (!questionScores.has(userId)) {
          questionScores.set(userId, new Map<string, Map<string, number>>());
        }
        if (!questionScores.get(userId)?.has(quizId)) {
          questionScores.get(userId)?.set(quizId, new Map<string, number>());
        }

        // Get the user's quiz map for question scores
        const userQuizQuestions = questionScores.get(userId)?.get(quizId);

        // Process each question in the attempt
        attempt.gradingResult.overallFeedback.forEach((feedback: any) => {
          if (!feedback.questionId || typeof feedback.score !== 'number')
            return;

          const questionId = feedback.questionId.toString();
          const currentMax = userQuizQuestions?.get(questionId) || 0;

          // Store the maximum score for each question
          if (feedback.score > currentMax) {
            userQuizQuestions?.set(questionId, feedback.score);
          }
        });
      });

      // Second pass: Process aggregated results for max scores
      results.forEach(result => {
        const userId = result.userId;
        const quizId = result.quizId;

        if (userId && quizId) {
          if (!maxScores.has(userId)) {
            maxScores.set(userId, new Map<string, number>());
          }
          maxScores.get(userId)?.set(quizId, result.scorePercentage);
        }
      });

      return {maxScores, questionScores};
    } catch (error) {
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

  private readonly BATCH_SIZE = 100;

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
      const errorMsg = `Invalid course or version ID format. CourseID valid: ${ObjectId.isValid(
        courseId,
      )}, VersionID valid: ${ObjectId.isValid(versionId)}`;
      console.error(`[ERROR] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const courseIdObj = new ObjectId(courseId);
    const versionIdObj = new ObjectId(versionId);
    const studentFilter = {
      courseId: courseIdObj,
      courseVersionId: versionIdObj,
      role: 'STUDENT' as EnrollmentRole,
      status: {$regex: /^active$/i},
    };

    try {
      const totalStudents = await this.enrollmentCollection.countDocuments(
        studentFilter,
      );
      if (totalStudents === 0) {
        return {
          data: [],
          metadata: {
            courseId,
            versionId,
            totalStudents: 0,
            durationMs: 0,
            generatedAt: new Date().toISOString(),
          },
        };
      }

      const quizzesByModuleSection = await this.getQuizIdsByModulesAndSections(
        versionId,
      );
      const allQuizIds = [
        ...new Set(
          quizzesByModuleSection.flatMap(m =>
            m.sections.flatMap(s => s.quizIds),
          ),
        ),
      ];

      if (allQuizIds.length === 0) {
        console.warn(
          `[WARN] No quiz IDs found for course version ${versionId}`,
        );
        return {
          data: [],
          metadata: {
            courseId,
            versionId,
            totalStudents: 0,
            durationMs: 0,
            generatedAt: new Date().toISOString(),
          },
        };
      }

      const validQuizIds = allQuizIds.filter((id): id is string => {
        const valid = typeof id === 'string' && ObjectId.isValid(id);
        if (!valid) console.error(`[ERROR] Invalid quiz ID format: ${id}`);
        return valid;
      });

      const quizIdsObj = validQuizIds.map(id => new ObjectId(id));
      const quizDetails = await this.getQuizDetails(quizIdsObj);

      // Pre-fetch all questions for each quiz only once
      const quizQuestionsMap = new Map<string, string[]>();
      await Promise.all(
        validQuizIds.map(async quizId => {
          const questions = await this.getQuizQuestionIds(quizId);
          quizQuestionsMap.set(quizId, questions);
        }),
      );

      const result: StudentQuizScoreDto[] = [];
      const totalBatches = Math.ceil(totalStudents / this.BATCH_SIZE);

      for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
        const skip = batchNum * this.BATCH_SIZE;

        const enrollments = await this.enrollmentCollection
          .aggregate([
            {$match: studentFilter},
            {$skip: skip},
            {$limit: this.BATCH_SIZE},
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
                _id: 1,
                userId: 1,
                'user.firstName': 1,
                'user.lastName': 1,
                'user.email': 1,
              },
            },
          ])
          .toArray();

        if (enrollments.length === 0) continue;

        const batchUserIds = enrollments.map(e => e.userId);
        const [scoresData, totalAttempts] = await Promise.all([
          this.getMaxScoresForQuizzes(batchUserIds, quizIdsObj),
          this.getUserQuizAttempts(batchUserIds, quizIdsObj),
        ]);

        const {maxScores, questionScores} = scoresData;

        const batchResults = enrollments.map(enrollment => {
          const userId = enrollment.userId.toString();
          const studentQuizScores: StudentQuizScoreDto['quizScores'] = [];

          for (const module of quizzesByModuleSection) {
            for (const section of module.sections) {
              for (const quizId of section.quizIds) {
                if (!validQuizIds.includes(quizId)) continue;

                const quizName =
                  quizDetails.get(quizId)?.name || 'Untitled Quiz';
                const allQuestionIds = quizQuestionsMap.get(quizId) || [];
                const studentQuestionScores =
                  questionScores.get(userId)?.get(quizId) || new Map();

                const questionScoresArr = allQuestionIds.map(questionId => ({
                  questionId,
                  score: studentQuestionScores.get(questionId) || 0,
                }));

                studentQuizScores.push({
                  moduleId: module.moduleId,
                  sectionId: section.sectionId,
                  quizId,
                  quizName,
                  maxScore: maxScores.get(userId)?.get(quizId) || 0,
                  questionScores: questionScoresArr,
                  attempts: totalAttempts.get(userId)?.get(quizId) || 0,
                });
              }
            }
          }

          return {
            studentId: userId,
            name:
              `${enrollment.user.firstName || ''} ${
                enrollment.user.lastName || ''
              }`.trim() || 'Unknown',
            email: enrollment.user.email || '',
            quizScores: studentQuizScores,
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
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('Error in getQuizScoresForCourseVersion:', error);
      throw new Error('Failed to fetch quiz scores');
    }
  }
  async getNonStudentEnrollmentsByCourseVersion(
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<IEnrollment[]> {
    try {
      const courseObjectId = new ObjectId(courseId);
      const versionObjectId = new ObjectId(courseVersionId);

      const enrollments = await this.enrollmentCollection
        .find(
          {
            courseId: courseObjectId,
            courseVersionId: versionObjectId,
            role: {$ne: 'STUDENT'},
          },
          {session},
        )
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
}
