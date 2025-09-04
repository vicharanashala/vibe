import { EnrollmentRole,
  IEnrollment,
  IProgress,
  ICourseVersion,
  IWatchTime
} from '#shared/interfaces/models.js';
import { injectable, inject } from 'inversify';
import { ClientSession, Collection, ObjectId } from 'mongodb';
import { InternalServerError, NotFoundError } from 'routing-controllers';
import { MongoDatabase } from '../MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { EnrollmentStats } from '#root/modules/users/types.js';
import { StudentQuizScoreDto, QuizScoresExportResponseDto } from '#root/modules/users/dtos/QuizScoresExportDto.js';

interface QuizMaxScores {
  [quizId: string]: number;
}

interface UserQuizAttempts {
  [userId: string]: {
    [quizId: string]: number;
  };
}

@injectable()
export class EnrollmentRepository {
  private enrollmentCollection!: Collection<IEnrollment>;
  private progressCollection!: Collection<IProgress>;
  private courseVersionCollection!: Collection<ICourseVersion>;
  private watchTimeCollection!: Collection<IWatchTime>;
  private submissionCollection!: any;
  private quizCollection!: any;
  private userQuizMetricsCollection!: any;
  private userCollection!: any;

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
    this.submissionCollection = await this.db.getCollection('quiz_submission_results');
    this.userQuizMetricsCollection = await this.db.getCollection('user_quiz_metrics');
    this.quizCollection = await this.db.getCollection('quizzes');
    this.userCollection = await this.db.getCollection('users');
  }

  /**
   * Find an enrollment by ID
   */
  /**
   * Get quiz scores for all students in a course version
   * @param courseId Course ID
   * @param versionId Course version ID
   * @returns Array of student quiz scores with their max scores and attempts
   */

  /**
   * Get quiz scores for all students in a course version
   * @param courseId Course ID
   * @param versionId Course version ID
   * @returns Array of student quiz scores with their max scores and attempts
   */
  async getQuizScoresForCourseVersion(
    courseId: string,
    versionId: string,
  ): Promise<QuizScoresExportResponseDto> {
    await this.init();
    
    if (!this.enrollmentCollection || !this.submissionCollection || !this.quizCollection) {
      throw new Error('Database collections not properly initialized');
    }

    try {
      // 1. Get all student enrollments for this course version with user details
      const enrollments = await this.enrollmentCollection.aggregate([
        {
          $match: {
            courseId: new ObjectId(courseId),
            courseVersionId: new ObjectId(versionId),
            role: 'STUDENT',
            status: 'ACTIVE'
          }
        },
        {
          $lookup: {
            from: 'users',
            let: { userId: '$userId' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$_id', '$$userId'] }
                }
              },
              {
                $project: {
                  _id: 1,
                  email: 1,
                  firstName: 1,
                  lastName: 1
                }
              }
            ],
            as: 'user',
          },
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

      if (!enrollments || enrollments.length === 0) {
        console.log('No student enrollments found for course version:', { 
          courseId, 
          versionId,
          role: 'STUDENT',
          status: 'ACTIVE'
        });
        return { data: [] };
      }

      const userIds = enrollments.map(e => e.userId);

      // 2. Get all quiz submissions for these users and course version
      const submissions = await this.submissionCollection.aggregate([
        {
          $match: {
            userId: { $in: userIds },
            courseId: new ObjectId(courseId),
            courseVersionId: new ObjectId(versionId),
            isSubmitted: true
          }
        },
        {
          $lookup: {
            from: 'user_quiz_metrics',
            let: { 
              quizId: '$quizId',
              userId: '$userId'
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$quizId', '$$quizId'] },
                      { $eq: ['$userId', '$$userId'] }
                    ]
                  }
                }
              },
              {
                $project: {
                  remainingAttempts: 1,
                  latestAttemptStatus: 1,
                  totalAttempts: { $size: '$attempts' },
                  latestSubmissionResultId: 1
                }
              }
            ],
            as: 'metrics',
          },
        },
        { $unwind: { path: '$metrics', preserveNullAndEmptyArrays: true } },
        {
          $sort: { 'gradingResult.gradedAt': -1 }
        },
        {
          $group: {
            _id: { userId: '$userId', quizId: '$quizId' },
            userId: { $first: '$userId' },
            quizId: { $first: '$quizId' },
            score: { $first: '$gradingResult.totalScore' },
            maxScore: { $first: '$gradingResult.totalMaxScore' },
            submittedAt: { $first: '$submittedAt' },
            gradedAt: { $first: '$gradingResult.gradedAt' },
            gradingStatus: { $first: '$gradingResult.gradingStatus' },
            totalAttempts: { $first: { $ifNull: ['$metrics.totalAttempts', 1] } },
            remainingAttempts: { $first: { $ifNull: ['$metrics.remainingAttempts', 0] } },
            latestAttemptStatus: { $first: { $ifNull: ['$metrics.latestAttemptStatus', 'UNKNOWN'] } }
          }
        },
        {
          $project: {
            _id: 0,
            userId: 1,
            quizId: 1,
            score: { $ifNull: ['$score', 0] },
            maxScore: { $ifNull: ['$maxScore', 10] },
            submittedAt: 1,
            gradedAt: 1,
            totalAttempts: 1,
            remainingAttempts: 1,
            status: {
              $switch: {
                branches: [
                  { case: { $eq: ['$gradingStatus', 'GRADED'] }, then: 'COMPLETED' },
                  { case: { $eq: ['$gradingStatus', 'FAILED'] }, then: 'FAILED' },
                  { case: { $eq: ['$latestAttemptStatus', 'ATTEMPTED'] }, then: 'SUBMITTED' },
                  { case: { $eq: ['$latestAttemptStatus', 'IN_PROGRESS'] }, then: 'IN_PROGRESS' }
                ],
                default: 'NOT_ATTEMPTED'
              }
            }
          }
        }
      ]).toArray();

      if (!submissions || submissions.length === 0) {
        console.log('No quiz submissions found for students in this course version');
        return { data: [] };
      }

      // 3. Get all quizzes for this course version with module and section info
      const quizzes = await this.quizCollection.find({
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(versionId),
        isActive: true
      }).project({
        _id: 1,
        title: 1,
        moduleId: 1,
        sectionId: 1
      }).toArray();

      if (quizzes.length === 0) {
        console.log('No quizzes found for this course version');
        return { data: [] };
      }

      // 4. Get max scores and attempts in parallel
      const quizIds = quizzes.map(q => q._id);
      const [maxScores, userAttempts] = await Promise.all([
        this.getMaxScoresForQuizzes(quizIds),
        this.getUserQuizAttempts(userIds, quizIds)
      ]);

      // 5. Process and format the results
      const result: StudentQuizScoreDto[] = [];
      
      for (const enrollment of enrollments) {
        const userId = enrollment.userId.toString();
        const userSubmissions = submissions.filter(s => s.userId.toString() === userId);
        
        // Create quiz scores array with all quizzes
        const quizScores = quizzes.map(quiz => {
          const submission = userSubmissions.find(s => s.quizId.toString() === quiz._id.toString());
          const quizId = quiz._id.toString();
          
          return {
            moduleId: quiz.moduleId?.toString() || '',
            sectionId: quiz.sectionId?.toString() || '',
            quizId,
            quizName: quiz.title,
            maxScore: maxScores[quizId] || 0,
            attempts: userAttempts[userId]?.[quizId] || 0,
            score: submission?.score || 0,
            submittedAt: submission?.submittedAt,
            gradingStatus: submission?.status || 'NOT_ATTEMPTED'
          };
        });
        
        // Add student to results
        result.push({
          studentId: userId,
          name: `${enrollment.user?.firstName || ''} ${enrollment.user?.lastName || ''}`.trim() || 'Unknown',
          email: enrollment.user?.email || '',
          quizScores
        });
      }

      return { data: result };
    } catch (error) {
      console.error('Error in getQuizScoresForCourseVersion:', error);
      throw new Error('Failed to fetch quiz scores');
    }
  }

  /**
   * Get maximum scores for a list of quizzes
   * @param quizIds Array of quiz IDs
   * @returns Object mapping quizId to maximum score
   */
  private async getMaxScoresForQuizzes(quizIds: ObjectId[]): Promise<Record<string, number>> {
    if (!quizIds.length) return {};
    
    const result = await this.submissionCollection.aggregate([
      {
        $match: {
          quizId: { $in: quizIds },
          isSubmitted: true
        }
      },
      {
        $group: {
          _id: '$quizId',
          maxScore: { $max: '$score' }
        }
      }
    ]).toArray();
    
    return result.reduce((acc: Record<string, number>, curr: any) => {
      acc[curr._id.toString()] = curr.maxScore || 0;
      return acc;
    }, {});
  }

  /**
   * Get number of attempts per user per quiz
   * @param userIds Array of user IDs
   * @param quizIds Array of quiz IDs
   * @returns Nested object mapping userId -> quizId -> attemptCount
   */
  private async getUserQuizAttempts(userIds: ObjectId[], quizIds: ObjectId[]): Promise<Record<string, Record<string, number>>> {
    if (!userIds.length || !quizIds.length) return {};
    
    const result = await this.submissionCollection.aggregate([
      {
        $match: {
          userId: { $in: userIds },
          quizId: { $in: quizIds },
          isSubmitted: true
        }
      },
      {
        $group: {
          _id: {
            userId: '$userId',
            quizId: '$quizId'
          },
          attempts: { $sum: 1 }
        }
      }
    ]).toArray();
    
    return result.reduce((acc: Record<string, Record<string, number>>, curr: any) => {
      const userId = curr._id.userId.toString();
      const quizId = curr._id.quizId.toString();
      
      if (!acc[userId]) {
        acc[userId] = {};
      }
      
      acc[userId][quizId] = curr.attempts;
      return acc;
    }, {});
  }

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
    courseVersionId: string
  ): Promise<IEnrollment | null> {
    await this.init();
    try {
      const query = {
        userId: new ObjectId(userId),
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId)
      };
      return await this.enrollmentCollection.findOne(query);
    } catch (error) {
      console.error('Error finding enrollment:', error);
      throw error;
    }
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
        { session }
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
          pipeline: [{ $project: { name: 1, versions: 1 } }],
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

    return await this.enrollmentCollection.aggregate(pipeline, { session }).toArray();
  }

  async getContentCountsForVersions(versionIds: ObjectId[]): Promise<Map<string, any>> {
    const results = await this.courseVersionCollection.aggregate([
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
            $sum: { $cond: [{ $eq: ['$itemsGroup.items.type', 'ARTICLE'] }, 1, 0] },
          },
        },
      },
    ]).toArray();

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


  async getWatchedItemCountsBatch(entries: {
    userId: ObjectId;
    courseId: ObjectId;
    courseVersionId: ObjectId;
  }[]): Promise<Map<string, number>> {
    const matchConditions = entries.map((e) => ({
      userId: e.userId,
      courseId: e.courseId,
      courseVersionId: e.courseVersionId,
    }));

    const results = await this.watchTimeCollection.aggregate([
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
    ]).toArray();

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
