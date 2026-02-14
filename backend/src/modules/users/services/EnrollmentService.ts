import { COURSES_TYPES } from '#courses/types.js';
import { InviteStatus } from '#root/modules/notifications/index.js';
import { BaseService } from '#root/shared/classes/BaseService.js';
import { ICourseRepository } from '#root/shared/database/interfaces/ICourseRepository.js';
import { IItemRepository } from '#root/shared/database/interfaces/IItemRepository.js';
import { IUserRepository } from '#root/shared/database/interfaces/IUserRepository.js';
import { MongoDatabase } from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {
  EnrollmentRole,
  EnrollmentStatus,
  ICourseVersion,
  IEnrollment,
} from '#root/shared/interfaces/models.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { EnrollmentRepository } from '#shared/database/providers/mongo/repositories/EnrollmentRepository.js';
import { Enrollment } from '#users/classes/transformers/Enrollment.js';
import { EnrollmentStats, USERS_TYPES } from '#users/types.js';
import { injectable, inject } from 'inversify';
import { ClientSession, ObjectId, OptionalId } from 'mongodb';
import {
  BadRequestError,
  NotFoundError,
  InternalServerError,
} from 'routing-controllers';
import { ProgressService } from './ProgressService.js';
import { ProgressRepository, InviteRepository } from '#root/shared/index.js';
import { EnrollmentDataResponse } from '../classes/index.js';
import {
  QuizScoresExportResponseDto,
  StudentQuizScoreDto,
} from '../dtos/QuizScoresExportDto.js';
import { COURSE_REGISTRATION_TYPES } from '#root/modules/courseRegistration/types.js';
import { ICourseRegistrationRepository } from '#root/shared/database/interfaces/ICourseRegistrationRepository.js';
import {
  IGradingResult,
  ISubmission,
} from '#root/modules/quizzes/interfaces/index.js';

@injectable()
export class EnrollmentService extends BaseService {
  constructor(
    @inject(USERS_TYPES.EnrollmentRepo)
    private readonly enrollmentRepo: EnrollmentRepository,
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,
    @inject(GLOBAL_TYPES.UserRepo) private readonly userRepo: IUserRepository,
    @inject(COURSES_TYPES.ItemRepo) private readonly itemRepo: IItemRepository,
    @inject(COURSE_REGISTRATION_TYPES.CourseRegistrationRepository)
    private courseRegistrationRepo: ICourseRegistrationRepository,
    @inject(USERS_TYPES.ProgressService)
    private readonly progressService: ProgressService,
    @inject(GLOBAL_TYPES.InviteRepo)
    private readonly inviteRepo: InviteRepository,
    @inject(USERS_TYPES.ProgressRepo)
    private readonly progressRepo: ProgressRepository,
    @inject(GLOBAL_TYPES.Database)
    private readonly database: MongoDatabase,
  ) {
    super(database);
  }

  async enrollUser(
    userId: string,
    courseId: string,
    courseVersionId: string,
    role: EnrollmentRole,
    throughInvite: boolean = false,
    session?: ClientSession,
  ) {
    const execute = async (session: ClientSession) => {
      const user = await this.userRepo.findById(userId, session);
      if (!user) throw new NotFoundError('User not found');

      const course = await this.courseRepo.read(courseId, session);
      if (!course) throw new NotFoundError('Course not found');

      const courseVersion = await this.courseRepo.readVersion(
        courseVersionId,
        session,
      );
      if (!courseVersion || courseVersion.courseId.toString() !== courseId) {
        throw new NotFoundError(
          'Course version not found or does not belong to this course',
        );
      }

      const existingEnrollment = await this.enrollmentRepo.findActiveEnrollment(
        userId,
        courseId,
        courseVersionId,
        session,
      );

      // if (existingEnrollment && !throughInvite) {
      //   throw new BadRequestError(
      //     'User is already enrolled in this course version',
      //   );
      // }

      if (existingEnrollment && throughInvite) {
        return { status: 'ALREADY_ENROLLED' as InviteStatus };
      }

      if (existingEnrollment && !throughInvite) {
        throw new BadRequestError(
          'User is already enrolled in this course version',
        );
      }

      const enrollmentData = {
        userId: new ObjectId(userId),
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
        role: role,
        status: 'ACTIVE' as EnrollmentStatus,
        enrollmentDate: new Date(),
        percentCompleted: 0,
        completedItemsCount: 0,
      };

      const createdEnrollment = await this.enrollmentRepo.createEnrollment(
        enrollmentData,
        session,
      );
      let initialProgress = null;
      if (createdEnrollment.role == 'STUDENT') {
        const progressData = await this.progressService.initializeProgress(
          userId,
          courseId,
          courseVersionId,
          courseVersion,
        );

        if (progressData) {
          initialProgress = await this.progressRepo.createProgress(
            {
              userId: new ObjectId(userId),
              courseId: new ObjectId(courseId),
              courseVersionId: new ObjectId(courseVersionId),
              currentModule: new ObjectId(
                progressData.currentModule.toString(),
              ),
              currentSection: new ObjectId(
                progressData.currentSection.toString(),
              ),
              currentItem: new ObjectId(progressData.currentItem.toString()),
              completed: false,
            },
            session,
          );
        } else {
          console.log(
            '=== ENROLLMENT: No progress data returned - course may have no valid items ===',
          );
        }
      }

      return {
        status: 'ENROLLED' as const,
        enrollment: createdEnrollment,
        progress: initialProgress,
        role: role,
      };
    };
    // If session provided, use it; otherwise wrap in a new transaction
    return session ? execute(session) : this._withTransaction(execute);
  }

  async findEnrollment(
    userId: string,
    courseId: string,
    courseVersionId: string,
  ) {
    return this._withTransaction(async (session: ClientSession) => {
      const user = await this.userRepo.findById(userId);
      if (!user) throw new NotFoundError('User not found');

      const course = await this.courseRepo.read(courseId);
      if (!course) throw new NotFoundError('Course not found');

      const courseVersion = await this.courseRepo.readVersion(
        courseVersionId,
        session,
      );
      if (!courseVersion || courseVersion.courseId.toString() !== courseId) {
        throw new NotFoundError(
          'Course version not found or does not belong to this course',
        );
      }
      const existingEnrollment = await this.enrollmentRepo.findEnrollment(
        userId,
        courseId,
        courseVersionId,
      );
      // if (!existingEnrollment) {
      //   throw new Error('User is not enrolled in this course version');
      // }

      return existingEnrollment;
    });
  }

  async findActiveEnrollment(
    userId: string,
    courseId: string,
    courseVersionId: string,
  ) {
    return this._withTransaction(async (session: ClientSession) => {
      const user = await this.userRepo.findById(userId);
      if (!user) throw new NotFoundError('User not found');

      const course = await this.courseRepo.read(courseId);
      if (!course) throw new NotFoundError('Course not found');

      const courseVersion = await this.courseRepo.readVersion(
        courseVersionId,
        session,
      );
      if (!courseVersion || courseVersion.courseId.toString() !== courseId) {
        throw new NotFoundError(
          'Course version not found or does not belong to this course',
        );
      }
      const existingEnrollment = await this.enrollmentRepo.findActiveEnrollment(
        userId,
        courseId,
        courseVersionId,
      );

      return existingEnrollment;
    });
  }

  async unenrollUser(
    userId: string,
    courseId: string,
    courseVersionId: string,
    enrollment: Enrollment | null,
  ) {
    return this._withTransaction(async (session: ClientSession) => {
      if (!enrollment) {
        throw new NotFoundError('Enrollment not found');
      }

      await this.progressService.unenrollUser(
        userId,
        courseId,
        courseVersionId,
        enrollment?._id.toString(),
        session,
      );

      return {
        enrollment: null,
        progress: null,
        role: enrollment.role,
      };
    });
  }

  async bulkUnenrollUsers(
    userIds: string[],
    courseId: string,
    courseVersionId: string,
  ): Promise<{
    successCount: number;
    failureCount: number;
    errors: string[];
  }> {
    const results = {
      successCount: 0,
      failureCount: 0,
      errors: [] as string[],
    };

    // Process unenrollments in parallel with error handling
    await Promise.allSettled(
      userIds.map(async (userId) => {
        try {
          const enrollment = await this.findActiveEnrollment(
            userId,
            courseId,
            courseVersionId,
          );

          if (!enrollment) {
            results.failureCount++;
            results.errors.push(
              `User ${userId}: No active enrollment found`,
            );
            return;
          }

          await this.unenrollUser(
            userId,
            courseId,
            courseVersionId,
            enrollment,
          );

          results.successCount++;
        } catch (error) {
          results.failureCount++;
          results.errors.push(
            `User ${userId}: ${error.message || 'Unknown error'}`,
          );
          console.error(`Failed to unenroll user ${userId}:`, error);
        }
      }),
    );

    return results;
  }


  private filterCourseVersions(course: any, enrolledVersionIds: Set<string>) {
    return {
      ...course,
      versions:
        course?.versions?.filter((versionId: string) =>
          enrolledVersionIds.has(versionId.toString()),
        ) || [],
    };
  }

  public async getEnrollments(
    userId: string,
    skip: number,
    limit: number,
    role: EnrollmentRole,
    search: string,
  ): Promise<EnrollmentDataResponse[]> {
    let enrollments = [];
    if (role === 'INSTRUCTOR') {
      enrollments = await this.enrollmentRepo.getBasicInstructorEnrollments(
        userId,
        skip,
        limit,
        role,
        search,
      );
    } else {
      enrollments = await this.enrollmentRepo.getBasicEnrollments(
        userId,
        skip,
        limit,
        role,
        search,
      );
    }

    if (!enrollments.length) return [];

    const enrolledVersionIds: Set<string> = new Set(
      enrollments.map(e => e.courseVersionId.toString()),
    );

    if (role === 'STUDENT') {
      // Get all active course versions in a single call
      const courseVersions = await this.courseRepo.getActiveVersions(
        Array.from(enrolledVersionIds),
      );

      // Create a map for quick lookup
      const versionToItemGroups = new Map<string, string[]>();

      courseVersions.forEach((version: ICourseVersion) => {
        const itemGroupIds: string[] = [];
        version.modules.forEach(module => {
          module.sections.forEach(section => {
            if (section.itemsGroupId) {
              itemGroupIds.push(section.itemsGroupId.toString());
            }
          });
        });
        versionToItemGroups.set(version._id.toString(), itemGroupIds);
      });

      const allItemGroupIds = Array.from(versionToItemGroups.values()).flat();

      const quizInfo = await this.itemRepo.getQuizInfo(allItemGroupIds);
      console.log(quizInfo[0]);
      // Extract actual quiz item IDs from quizInfo
      const allQuizIds = quizInfo
        .filter(quiz => quiz.items?._id)
        .map(quiz => quiz.items._id.toString());

      const watchedKeys = enrollments.map(e => ({
        userId: new ObjectId(userId),
        courseId: new ObjectId(e.courseId),
        courseVersionId: new ObjectId(e.courseVersionId),
      }));

      // Batch all async operations together
      const [watchedItemsMap, watchedItemsByTypeMap, quizSubmissionGrades]: [
        Map<string, number>,
        Map<string, { videos: number; quizzes: number; articles: number; projects: number }>,
        ISubmission[],
      ] = await Promise.all([
        this.enrollmentRepo.getWatchedItemCountsBatch(watchedKeys),
        this.enrollmentRepo.getWatchedItemCountsByTypeBatch(watchedKeys),
        allQuizIds.length > 0
          ? this.enrollmentRepo.getQuizSubmissionGrade(userId, allQuizIds)
          : Promise.resolve([]),
      ]);

      // Create a map for quick quiz grade lookup
      const quizGradeMap: Map<string, IGradingResult> = new Map(
        quizSubmissionGrades.map(grade => [
          grade.quizId.toString(),
          grade.gradingResult,
        ]),
      );

      return enrollments.map(enr => {
        const versionIdStr = enr.courseVersionId.toString();
        const watchedKey = `${userId}-${enr.courseId.toString()}-${versionIdStr}`;
        const versionItemGroups = versionToItemGroups.get(versionIdStr) || [];
        const versionQuizIds = quizInfo.filter(quiz =>
          versionItemGroups.includes(quiz._id.toString()),
        );

        // Get quiz grades for this enrollment's quizzes
        const enrollmentQuizGrades = versionQuizIds
          .map(q =>
            q.items?._id ? quizGradeMap.get(q.items._id.toString()) : null,
          )
          .filter(Boolean) as IGradingResult[];

        // update percentage if contentCountsMap / watchedItemsMap has different value from enrollment.percentCompleted
        // ratio is calculated as (watchedItems / totalItems) * 100

        const completedCount = watchedItemsMap.get(watchedKey) || 0;

        const ratio = completedCount / (enr.totalItems || 1); // avoid division by zero
        // const calculatedPercent = Math.floor(ratio * 100);
        const calculatedPercent = Number((ratio * 100).toFixed(2));

        // if different, update enrollment percentCompleted and completedItemsCount
        if (enr.percentCompleted !== calculatedPercent) {
          /*console.log(
            `Updating percentCompleted for enrollment ${enr._id.toString()} from ${
              enr.percentCompleted
            } to ${calculatedPercent}`,
          );*/

          void this.enrollmentRepo.updateProgressPercentById(
            enr._id.toString(),
            calculatedPercent,
            undefined,
            completedCount,
          );

          enr.percentCompleted = calculatedPercent;
          enr.completedItemsCount = completedCount;
        }

        if (enr.percentCompleted >= 0) {
          const itemCounts = enr.itemCounts || {};
          const completedByType = watchedItemsByTypeMap.get(watchedKey) || { videos: 0, quizzes: 0, articles: 0, projects: 0 };

          return {
            _id: enr._id.toString(),
            courseId: enr.courseId.toString(),
            courseVersionId: versionIdStr,
            role: enr.role,
            status: enr.status,
            enrollmentDate: new Date(enr.enrollmentDate),
            course: this.filterCourseVersions(enr.course, enrolledVersionIds),
            percentCompleted: enr.percentCompleted || 0,
            moduleNumber: enr.moduleNumber,
            sectionNumber: enr.sectionNumber,
            itemType: enr.itemType,
            contentCounts: {
              totalItems: enr.totalItems ?? 0,
              videos: itemCounts.VIDEO ?? itemCounts.videos ?? 0,
              quizzes: itemCounts.QUIZ ?? itemCounts.quizzes ?? 0,
              articles: itemCounts.BLOG ?? itemCounts.articles ?? 0,
              project: itemCounts.PROJECT ?? itemCounts.project ?? 0,
              totalQuizScore: enrollmentQuizGrades.reduce(
                (sum, grade) => sum + (grade.totalScore || 0),
                0,
              ),
              totalQuizMaxScore: enrollmentQuizGrades.reduce(
                (sum, grade) => sum + (grade.totalMaxScore || 0),
                0,
              ),
              // Completed counts by type
              completedVideos: completedByType.videos,
              completedQuizzes: completedByType.quizzes,
              completedArticles: completedByType.articles,
              completedProjects: completedByType.projects,
            },

            completedItems: watchedItemsMap.get(watchedKey) || 0,
          };
        }
      });
    }

    // Non-student
    return enrollments.map(enr => ({
      _id: enr._id.toString(),
      courseId: enr.courseId.toString(),
      courseVersionId: enr.courseVersionId.toString(),
      role: enr.role,
      status: enr.status,
      enrollmentDate: new Date(enr.enrollmentDate),
      course: this.filterCourseVersions(enr.course, enrolledVersionIds),
    }));
  }

  async getAllEnrollments(userId: string) {
    return this._withTransaction(async (session: ClientSession) => {
      const result = await this.enrollmentRepo.getAllEnrollments(
        userId,
        session,
      );
      return result.map(enrollment => ({
        ...enrollment,
        _id: enrollment._id.toString(),
        courseId: enrollment.courseId.toString(),
        courseVersionId: enrollment.courseVersionId.toString(),
      }));
    });
  }

  async getCourseVersionEnrollments(
    courseId: string,
    courseVersionId: string,
    skip: number,
    limit: number,
    search: string,
    sortBy: 'name' | 'enrollmentDate' | 'progress' | 'unenrolledAt',
    sortOrder: 'asc' | 'desc',
    filter: string,
    statusTab: 'ACTIVE' | 'INACTIVE' = 'ACTIVE',
  ) {
    return this._withTransaction(async (session: ClientSession) => {
      const courseVersion = await this.courseRepo.readVersion(
        courseVersionId,
        session,
      );
      if (!courseVersion || courseVersion?.courseId?.toString() !== courseId) {
        // return empty result instead of throwing error
        return {
          enrollments: [],
          totalCount: 0,
          totalPages: 0,
          currentPage: 0,
        };
      }

      const enrollmentsData =
        await this.enrollmentRepo.getCourseVersionEnrollments(
          courseId,
          courseVersionId,
          skip,
          limit,
          search,
          sortBy,
          sortOrder,
          filter,
          statusTab,
          session,
        );

      // if (enrollmentsData.enrollments.length > 0 && filter === 'STUDENT') {
      //   await this.enrichEnrollmentsWithQuizScores(
      //     enrollmentsData.enrollments,
      //     courseVersionId,
      //   );
      //   // Log sample enrollment to verify mutation
      //   console.log(
      //     '🔍 Sample enriched enrollment:',
      //     JSON.stringify(enrollmentsData.enrollments[0], null, 2),
      //   );
      // }

      if (enrollmentsData.enrollments.length > 0 && filter === 'STUDENT') {

        // existing quiz score enrichment
        await this.enrichEnrollmentsWithQuizScores(
          enrollmentsData.enrollments,
          courseVersionId,
        );

        // NEW: reuse getEnrollments()
        const studentUserIds = enrollmentsData.enrollments.map(e =>
          e.userId?.toString(),
        );

        // call getEnrollments for each student (parallel)
        const allStudentEnrollments = await Promise.all(
          studentUserIds.map(uid =>
            this.getEnrollments(uid, 0, 100, 'STUDENT', ''),
          ),
        );

        // flatten
        const flattened = allStudentEnrollments.flat();

        // build lookup map
        const contentCountsMap = new Map<
          string,
          any
        >();

        flattened.forEach(enr => {
          const key = `${enr.courseVersionId}-${enr._id}`;
          contentCountsMap.set(key, enr.contentCounts);
        });

        // attach to instructor enrollments
        enrollmentsData.enrollments.forEach(enr => {
          const key = `${enr.courseVersionId.toString()}-${enr._id.toString()}`;
          enr.contentCounts = contentCountsMap.get(key);
        });
      }


      return enrollmentsData;
    });
  }

  async getCourseVersionEnrollmentStatistics(
    courseId: string,
    versionId: string,
  ): Promise<EnrollmentStats> {
    return this._withTransaction(async (session: ClientSession) => {
      return await this.enrollmentRepo.getVersionEnrollmentStats(
        courseId,
        versionId,
        session,
      );
    });
  }

  /**
   * Enrich enrollments with quiz score information
   * Handles the calculation in Node since we don't maintain reverse lookups in DB
   * @private
   */
  private async enrichEnrollmentsWithQuizScores(
    enrollments: any[],
    courseVersionId: string,
  ): Promise<void> {
    if (!enrollments.length) return;

    // 1. Get item groups for this course version
    const courseVersion = await this.courseRepo.readVersion(courseVersionId);
    if (!courseVersion) return;

    const itemGroupIds: string[] = [];
    courseVersion.modules.forEach(module => {
      module.sections.forEach(section => {
        if (section.itemsGroupId) {
          itemGroupIds.push(section.itemsGroupId.toString());
        }
      });
    });

    if (!itemGroupIds.length) {
      // No item groups - set default scores
      enrollments.forEach(enr => {
        enr.totalQuizScore = 0;
        enr.totalQuizMaxScore = 0;
      });
      return;
    }

    // 2. Get quiz info from item groups
    const quizInfo = await this.itemRepo.getQuizInfo(itemGroupIds);
    const allQuizIds = quizInfo
      .filter(quiz => quiz.items?._id)
      .map(quiz => quiz.items._id.toString());

    if (!allQuizIds.length) {
      // No quizzes - set default scores
      enrollments.forEach(enr => {
        enr.totalQuizScore = 0;
        enr.totalQuizMaxScore = 0;
      });
      return;
    }

    // 3. Get all user IDs from enrollments
    const userIds = enrollments.map(e => e.userId);
    console.log('🔍 User IDs for quiz lookup:', enrollments);

    // 4. Batch fetch quiz submissions for all users
    const quizSubmissions =
      await this.enrollmentRepo.getBatchQuizSubmissionGrades(
        userIds,
        allQuizIds,
      );

    // 5. Create a map: userId -> quiz grades
    const userQuizGradesMap = new Map<string, IGradingResult[]>();

    quizSubmissions.forEach(submission => {
      const userId = submission.userId.toString();
      const gradingResult = submission.gradingResult;

      if (!userQuizGradesMap.has(userId)) {
        userQuizGradesMap.set(userId, []);
      }
      userQuizGradesMap.get(userId)!.push(gradingResult);
    });

    // 6. Enrich each enrollment with scores
    enrollments.forEach(enr => {
      const userId = enr.userId;
      const userGrades = userQuizGradesMap.get(userId) || [];

      enr.totalQuizScore = userGrades.reduce(
        (sum, grade) => sum + (grade.totalScore || 0),
        0,
      );
      enr.totalQuizMaxScore = userGrades.reduce(
        (sum, grade) => sum + (grade.totalMaxScore || 0),
        0,
      );
    });
  }

  /**
   * Get quiz scores for all students in a course version with optimized batching
   * @param courseId Course ID
   * @param versionId Course version ID
   * @returns Promise with quiz scores data and metadata
   * @throws {NotFoundError} When course or version is not found
   * @throws {Error} When there's an error fetching quiz scores
   */
  async getQuizScoresForCourseVersion(
    courseId: string,
    versionId: string,
    statusTab: 'ACTIVE' | 'INACTIVE' = 'ACTIVE',
  ): Promise<QuizScoresExportResponseDto> {
    try {
      // Verify course and version exist in a single transaction
      const [course, version] = await Promise.all([
        this.courseRepo.read(courseId),
        this.courseRepo.readVersion(versionId),
      ]);

      if (!course) {
        throw new NotFoundError('Course not found');
      }
      if (!version) {
        throw new NotFoundError('Course version not found');
      }

      // Get quiz scores from repository with batching
      return await this.enrollmentRepo.getQuizScoresForCourseVersion(
        courseId,
        versionId,
        statusTab,
      );
    } catch (error) {
      console.error(
        `Error in getQuizScoresForCourseVersion for course ${courseId}, version ${versionId}:`,
        error,
      );

      // Rethrow with more context if it's not already a known error
      if (error instanceof NotFoundError) {
        throw error;
      }

      throw new Error(`Failed to fetch quiz scores: ${error.message}`);
    }
  }

  async countEnrollments(userId: string, role: EnrollmentRole, search: string) {
    return this._withTransaction(async (session: ClientSession) => {
      const result = await this.enrollmentRepo.countEnrollments(userId, role, search);
      return result;
    });
  }

  async getInstructorEnrollment(courseId: string, versionId: string) {
    return this.enrollmentRepo.getByCourseVersion(courseId, versionId);
  }
  async processBulkInvite(userId: string, inviteId: string): Promise<void> {
    const invite = await this.inviteRepo.findInviteById(inviteId);
    if (!invite) {
      throw new Error('Bulk Invite Not Found');
    }
    const result = await this.enrollUser(
      userId,
      invite.courseId.toString(),
      invite.courseVersionId.toString(),
      invite.role,
      true,
    );
    if (!result) {
      throw new InternalServerError('Failed to enroll user from Bulk Invite');
    }
    if (result.status === 'ENROLLED') {
      invite.usedCount = (invite.usedCount || 0) + 1;
      await this.inviteRepo.updateInvite(inviteId, invite);
    }
  }

  /**
   * Initialize student progress tracking to the first item in the course.
   * Private helper method for the enrollment process.
   */
  /**
   * Bulk update watchtime and recalculate progress for specific user/course/version
   * @param courseId Course ID (optional)
   * @param versionId Course version ID (optional)
   * @param userId User ID (optional)
   * @returns Promise with operation results
   */
  async bulkUpdateWatchTimeAndRecalculateProgress(
    courseId?: string,
    versionId?: string,
    userId?: string,
  ): Promise<{
    success: boolean;
    summary: {
      enrollmentsFound: number;
      watchtimeUpdated: number;
      progressRecalculated: number;
    };
    message: string;
  }> {
    try {
      const enrollments = await this.enrollmentRepo.getEnrollmentsByFilters({
        courseId,
        courseVersionId: versionId,
        userId,
      });

      console.log(`🔍 Found ${enrollments.length} enrollments to process`);

      let watchtimeUpdated = 0;

      // 🔥 Parallel watchtime updates (safe + faster)
      await Promise.allSettled(
        enrollments.map(async enrollment => {
          try {
            await this.progressService.createBulkWatchiTimeDocs(
              enrollment.courseId.toString(),
              enrollment.courseVersionId.toString(),
              enrollment.userId.toString(),
            );
            watchtimeUpdated++;
          } catch (err) {
            console.error(
              `❌ Watchtime update failed for enrollment ${enrollment._id}`,
              err?.message || err,
            );
          }
        }),
      );

      // ♻️ Recalculate progress
      const progressResult = await this.bulkUpdateAllEnrollments(
        courseId,
        userId,
      );

      const message =
        watchtimeUpdated > 0
          ? `Successfully updated watchtime for ${watchtimeUpdated} enrollments and recalculated progress for ${progressResult.updatedCount} enrollments`
          : `Watchtime update failed for all enrollments, but progress was recalculated for ${progressResult.updatedCount} enrollments`;

      return {
        success: true,
        summary: {
          enrollmentsFound: enrollments.length,
          watchtimeUpdated,
          progressRecalculated: progressResult.updatedCount,
        },
        message,
      };
    } catch (error) {
      console.error(
        '❌ Error in bulkUpdateWatchTimeAndRecalculateProgress',
        error,
      );

      return {
        success: false,
        summary: {
          enrollmentsFound: 0,
          watchtimeUpdated: 0,
          progressRecalculated: 0,
        },
        message: `Failed to bulk update watchtime and recalculate progress: ${error.message}`,
      };
    }
  }

  async bulkUpdateAllEnrollments(
    courseId?: string,
    userId?: string,
  ): Promise<{ totalCount: number; updatedCount: number }> {
    const BATCH_SIZE = 5000;

    // 1. Get courses (all or specific one)
    let courses = [];
    if (courseId) {
      const course = await this.courseRepo.read(courseId);
      if (!course) {
        throw new Error(`Course with id ${courseId} not found`);
      }
      courses = [course];
    } else {
      courses = await this.courseRepo.getAllCourses();
    }

    const courseVersionIds = courses.flatMap(course => course.versions);

    const bulkOperations = [];
    let batchCount = 0;
    let totalCount = 0;
    let updatedCount = 0;

    for (const courseVersionId of courseVersionIds) {
      try {
        const courseVersion = await this.courseRepo.readVersion(
          courseVersionId as string,
        );
        if (!courseVersion) continue;

        const totalItems = await this.itemRepo.CalculateTotalItemsCount(
          courseVersion.courseId.toString(),
          courseVersion._id.toString(),
        );

        // const enrollments = await this.enrollmentRepo.getByCourseVersion(
        //   courseVersion.courseId.toString(),
        //   courseVersion._id.toString(),
        // );

        const enrollments = await this.enrollmentRepo.getEnrollmentsByFilters({
          courseId: courseVersion.courseId.toString(),
          courseVersionId: courseVersion._id.toString(),
          userId,
        });

        totalCount += enrollments.length;

        for (const enrollment of enrollments) {
          try {
            const completedItems =
              await this.progressService.getUserProgressPercentageWithoutTotal(
                enrollment.userId.toString(),
                courseVersion.courseId.toString(),
                courseVersion._id.toString(),
              );

            const percentCompleted = Math.round(
              (totalItems > 0 ? completedItems / totalItems : 0) * 100,
            );

            bulkOperations.push({
              updateOne: {
                filter: { _id: new ObjectId(enrollment._id) },
                update: {
                  $set: {
                    percentCompleted,
                    completedItemsCount: completedItems,
                  },
                },
              },
            });

            if (bulkOperations.length === BATCH_SIZE) {
              await this._withTransaction(async session => {
                await this.enrollmentRepo.bulkUpdateEnrollments(
                  bulkOperations,
                  session,
                );
                updatedCount += bulkOperations.length;
                console.log(
                  `✅ Batch ${++batchCount}: Updated ${bulkOperations.length
                  } enrollments`,
                );
                bulkOperations.length = 0;
              });
            }
          } catch (err) {
            console.error(
              `Failed to process enrollment ${enrollment._id}`,
              err,
            );
          }
        }
      } catch (err) {
        console.error(
          `Failed to process course version ${courseVersionId}`,
          err,
        );
      }
    }

    // Process any remaining operations
    if (bulkOperations.length > 0) {
      await this._withTransaction(async session => {
        await this.enrollmentRepo.bulkUpdateEnrollments(
          bulkOperations,
          session,
        );
        updatedCount += bulkOperations.length;
        console.log(
          `✅ Final batch: Updated ${bulkOperations.length} enrollments`,
        );
      });
    }

    return { totalCount, updatedCount };
  }

  async getNonStudentEnrollmentsByCourseVersion(
    courseId: string,
    courseVersionId: string,
  ): Promise<IEnrollment[]> {
    return await this.enrollmentRepo.getNonStudentEnrollmentsByCourseVersion(
      courseId,
      courseVersionId,
    );
  }
  async bulkEnrollUsers(
    existingEnrolledUsersWithRoles: { userId: string; role: EnrollmentRole }[],
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ) {
    const execute = async (session: ClientSession) => {
      const course = await this.courseRepo.read(courseId, session);
      if (!course) throw new NotFoundError('Course not found');

      const courseVersion = await this.courseRepo.readVersion(
        courseVersionId,
        session,
      );
      if (!courseVersion || courseVersion.courseId.toString() !== courseId) {
        throw new NotFoundError(
          'Course version not found or does not belong to this course',
        );
      }

      const enrollmentsToCreate: OptionalId<IEnrollment>[] = [];
      const results: any[] = [];

      for (const { userId, role } of existingEnrolledUsersWithRoles) {
        const userExists = await this.userRepo.findById(userId, session);

        if (!userExists) {
          results.push({ userId, error: 'User not found' });
          continue;
        }
        const existingEnrollment =
          await this.enrollmentRepo.findActiveEnrollment(
            userId,
            courseId,
            courseVersionId,
            session,
          );

        if (existingEnrollment) {
          // User already enrolled, skip
          results.push({
            userId,
            status: 'ALREADY_ENROLLED',
            enrollmentId: existingEnrollment._id.toString(),
          });
          continue;
        }

        enrollmentsToCreate.push({
          userId: new ObjectId(userId),
          courseId: new ObjectId(courseId),
          courseVersionId: new ObjectId(courseVersionId),
          role,
          status: 'ACTIVE' as EnrollmentStatus,
          enrollmentDate: new Date(),
          percentCompleted: 0,
          completedItemsCount: 0,
        });
      }

      if (enrollmentsToCreate.length > 0) {
        const insertedIds = await this.enrollmentRepo.createEnrollments(
          enrollmentsToCreate,
          session,
        );

        enrollmentsToCreate.forEach((enrollment, index) => {
          results.push({
            userId: enrollment.userId.toString(),
            enrollmentId: insertedIds[index],
            role: enrollment.role,
          });
        });
      }

      return results;
    };
    return session ? execute(session) : this._withTransaction(execute);
  }

  async addIndex(): Promise<void> {
    await this._withTransaction(async session => {
      await this.enrollmentRepo.addEnrollmentIndexes(session);
    });
  }

  async getUserEnrollmentsByCourseVersion(
    userId: string,
    courseId: string,
    courseVersionId: string,
  ): Promise<IEnrollment> {
    return this._withTransaction(async (session: ClientSession) => {
      return this.enrollmentRepo.getUserEnrollmentsByCourseVersion(
        userId,
        courseId,
        courseVersionId,
        session,
      );
    });
  }

  async bulkUpdateCompletedItemsCountParallelPerCourseVersion(
    courseId?: string,
    userId?: string,
  ): Promise<{ totalCount: number; updatedCount: number }> {
    const MAX_CONCURRENCY = 4;

    // 1. Load courses
    const courses = courseId
      ? [await this.courseRepo.read(courseId)]
      : await this.courseRepo.getAllCourses();

    if (!courses.length || courses.some(c => !c)) {
      throw new Error('Course not found');
    }

    // 2. Extract courseVersionIds
    const courseVersionIds = courses.flatMap(c =>
      c.versions.map(v => v.toString()),
    );

    let index = 0;

    // 🔑 THIS is the Safe Alternative
    const results: { totalCount: number; updatedCount: number }[] = [];

    // 3. Worker
    const worker = async () => {
      while (index < courseVersionIds.length) {
        const currentIndex = index++;
        const courseVersionId = courseVersionIds[currentIndex];

        const result =
          await this.enrollmentRepo.bulkUpdateCompletedItemsCountForCourseVersion(
            { courseVersionId, courseId, userId },
          );

        // ✅ push result instead of mutating shared counters
        results.push(result);
      }
    };

    // 4. Start workers
    const workers = Array.from({ length: MAX_CONCURRENCY }, () => worker());

    await Promise.all(workers);

    // 5. Final aggregation (SAFE)
    const totalCount = results.reduce((sum, r) => sum + r.totalCount, 0);
    const updatedCount = results.reduce((sum, r) => sum + r.updatedCount, 0);

    return { totalCount, updatedCount };
  }

  async getModuleProgressForUser(
    userId: string,
    courseId: string,
    versionId: string,
  ): Promise<Array<{
    moduleId: string;
    moduleName: string;
    totalItems: number;
    completedItems: number;
  }>> {

    return await this.progressService.getModuleWiseProgress(
      userId,
      courseId,
      versionId,
    );
  }
}
