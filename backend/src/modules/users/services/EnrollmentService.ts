import {COURSES_TYPES} from '#courses/types.js';
import {InviteStatus} from '#root/modules/notifications/index.js';
import {BaseService} from '#root/shared/classes/BaseService.js';
import {ICourseRepository} from '#root/shared/database/interfaces/ICourseRepository.js';
import {IItemRepository} from '#root/shared/database/interfaces/IItemRepository.js';
import {IUserRepository} from '#root/shared/database/interfaces/IUserRepository.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {
  EnrollmentRole,
  EnrollmentStatus,
  ICourseVersion,
  IEnrollment,
} from '#root/shared/interfaces/models.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {EnrollmentRepository} from '#shared/database/providers/mongo/repositories/EnrollmentRepository.js';
import {Enrollment} from '#users/classes/transformers/Enrollment.js';
import {EnrollmentStats, USERS_TYPES} from '#users/types.js';
import {injectable, inject} from 'inversify';
import {ClientSession, ObjectId, OptionalId} from 'mongodb';
import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from 'routing-controllers';
import {ProgressService} from './ProgressService.js';
import {InviteRepository, ProgressRepository} from '#root/shared/index.js';
import {EnrollmentDataResponse} from '../classes/index.js';

import {
  QuizScoresExportResponseDto,
  StudentQuizScoreDto,
} from '../dtos/QuizScoresExportDto.js';
import {
  ANOMALIES_TYPES,
  AnomalyRepository,
} from '#root/modules/anomalies/index.js';
import {GENAI_TYPES} from '#root/modules/genAI/types.js';
import {GenAIRepository} from '#root/modules/genAI/repositories/providers/mongodb/GenAIRepository.js';
import {NOTIFICATIONS_TYPES} from '#root/modules/notifications/types.js';
import {QUIZZES_TYPES} from '#root/modules/quizzes/types.js';
import {
  AttemptRepository,
  QuestionBankRepository,
  QuizRepository,
  SubmissionRepository,
  UserQuizMetricsRepository,
} from '#root/modules/quizzes/repositories/index.js';

@injectable()
export class EnrollmentService extends BaseService {
  constructor(
    @inject(USERS_TYPES.ProgressService)
    private readonly progressService: ProgressService,

    @inject(USERS_TYPES.EnrollmentRepo)
    private readonly enrollmentRepo: EnrollmentRepository,
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,
    @inject(GLOBAL_TYPES.UserRepo) private readonly userRepo: IUserRepository,
    @inject(COURSES_TYPES.ItemRepo) private readonly itemRepo: IItemRepository,
    @inject(USERS_TYPES.ProgressRepo)
    private readonly progressRepo: ProgressRepository,
    @inject(ANOMALIES_TYPES.AnomalyRepository)
    private anomalyRepository: AnomalyRepository,
    @inject(GENAI_TYPES.GenAIRepository)
    private readonly genAIRepository: GenAIRepository,
    @inject(NOTIFICATIONS_TYPES.InviteRepo)
    private readonly inviteRepo: InviteRepository,
    @inject(QUIZZES_TYPES.QuestionBankRepo)
    private questionBankRepository: QuestionBankRepository,
    @inject(QUIZZES_TYPES.SubmissionRepo)
    public readonly submissionRepo: SubmissionRepository,
    @inject(QUIZZES_TYPES.QuizRepo)
    public readonly quizRepo: QuizRepository,
    @inject(QUIZZES_TYPES.UserQuizMetricsRepo)
    private userQuizMetricsRepo: UserQuizMetricsRepository,
    @inject(QUIZZES_TYPES.AttemptRepo)
    private attemptRepo: AttemptRepository,

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

      const existingEnrollment = await this.enrollmentRepo.findEnrollment(
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
        return {status: 'ALREADY_ENROLLED' as InviteStatus};
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
      };

      const createdEnrollment = await this.enrollmentRepo.createEnrollment(
        enrollmentData,
        session,
      );
      let initialProgress = null;
      if (createdEnrollment.role == 'STUDENT') {
        initialProgress = await this.initializeProgress(
          userId,
          courseId,
          courseVersionId,
          courseVersion,
          session,
        );
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
      if (!existingEnrollment) {
        throw new Error('User is not enrolled in this course version');
      }

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
        session,
      );

      return {
        enrollment: null,
        progress: null,
        role: enrollment.role,
      };
    });
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
    return this._withTransaction(async (session: ClientSession) => {
      const enrollments = await this.enrollmentRepo.getBasicEnrollments(
        userId,
        skip,
        limit,
        role,
        search,
        session,
      );

      if (!enrollments.length) return [];

      const enrolledVersionIds = new Set(
        enrollments.map(e => e.courseVersionId.toString()),
      );

      if (role === 'STUDENT') {
        const versionIds = Array.from(enrolledVersionIds).map(
          id => new ObjectId(id),
        );
        const watchedKeys = enrollments.map(e => ({
          userId: new ObjectId(userId),
          courseId: new ObjectId(e.courseId),
          courseVersionId: new ObjectId(e.courseVersionId),
        }));

        const [contentCountsMap, watchedItemsMap] = await Promise.all([
          this.enrollmentRepo.getContentCountsForVersions(versionIds),
          this.enrollmentRepo.getWatchedItemCountsBatch(watchedKeys),
        ]);

        return enrollments.map(enr => {
          const versionIdStr = enr.courseVersionId.toString();
          const watchedKey = `${userId}-${enr.courseId.toString()}-${versionIdStr}`;

          return {
            _id: enr._id.toString(),
            courseId: enr.courseId.toString(),
            courseVersionId: versionIdStr,
            role: enr.role,
            status: enr.status,
            enrollmentDate: new Date(enr.enrollmentDate),
            course: this.filterCourseVersions(enr.course, enrolledVersionIds),
            percentCompleted: enr.percentCompleted || 0,
            contentCounts: contentCountsMap.get(versionIdStr) || {
              totalItems: 0,
              videos: 0,
              quizzes: 0,
              articles: 0,
            },
            completedItems: watchedItemsMap.get(watchedKey) || 0,
          };
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
    });
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
    sortBy: 'name' | 'enrollmentDate' | 'progress',
    sortOrder: 'asc' | 'desc',
    filter: string,
  ) {
    return this._withTransaction(async (session: ClientSession) => {
      const courseVersion = await this.courseRepo.readVersion(
        courseVersionId,
        session,
      );
      if (!courseVersion || courseVersion.courseId.toString() !== courseId) {
        throw new NotFoundError(
          'Course version not found or does not belong to this course',
        );
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
          session,
        );

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

      console.log(
        `Starting quiz scores export for course ${courseId}, version ${versionId}`,
      );

      // Get quiz scores from repository with batching
      return await this.enrollmentRepo.getQuizScoresForCourseVersion(
        courseId,
        versionId,
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

  async countEnrollments(userId: string, role: EnrollmentRole) {
    return this._withTransaction(async (session: ClientSession) => {
      const result = await this.enrollmentRepo.countEnrollments(userId, role);
      return result;
    });
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
  private async initializeProgress(
    userId: string,
    courseId: string,
    courseVersionId: string,
    courseVersion: ICourseVersion,
    session: ClientSession,
  ) {
    // Get the first module, section, and item
    if (!courseVersion.modules || courseVersion.modules.length === 0) {
      return null; // No modules to track progress for
    }

    const firstModule = courseVersion.modules.sort((a, b) =>
      a.order.localeCompare(b.order),
    )[0];

    if (!firstModule.sections || firstModule.sections.length === 0) {
      return null; // No sections to track progress for
    }

    const firstSection = firstModule.sections.sort((a, b) =>
      a.order.localeCompare(b.order),
    )[0];

    // Get the first item from the itemsGroup
    const itemsGroup = await this.itemRepo.readItemsGroup(
      firstSection.itemsGroupId.toString(),
      session,
    );

    if (!itemsGroup || !itemsGroup.items || itemsGroup.items.length === 0) {
      return null; // No items to track progress for
    }

    const firstItem = itemsGroup.items.sort((a, b) =>
      a.order.localeCompare(b.order),
    )[0];

    // Create progress record
    return await this.enrollmentRepo.createProgress(
      {
        userId: new ObjectId(userId),
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
        currentModule: firstModule.moduleId,
        currentSection: firstSection.sectionId,
        currentItem: firstItem._id,
        completed: false,
      },
      session,
    );
  }

  async bulkUpdateAllEnrollments(
    courseId?: string,
  ): Promise<{totalCount: number; updatedCount: number}> {
    const BATCH_SIZE = 5000;

    // 1. Get courses (all or specific one)
    let courses = [];
    if (courseId) {
      console.log(`Processing enrollments for courseId: ${courseId}`);
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

        const enrollments = await this.enrollmentRepo.getByCourseVersion(
          courseVersion.courseId.toString(),
          courseVersion._id.toString(),
        );

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
                filter: {_id: new ObjectId(enrollment._id)},
                update: {$set: {percentCompleted}},
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
                  `✅ Batch ${++batchCount}: Updated ${
                    bulkOperations.length
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

    return {totalCount, updatedCount};
  }

  async bulkUpdateIdConversion(
    collection:
      | 'anomaly_records'
      | 'genAI_jobs'
      | 'invites'
      | 'itemsGroup'
      | 'job_task_status'
      | 'newCourse'
      | 'newCourseVersion'
      | 'questionBanks'
      | 'quiz_submission_results'
      | 'quizzes'
      | 'user_quiz_metrics'
      | 'quiz_attempts'
  ): Promise<void> {
    try {
      const BATCH_SIZE = 1000;
      const handlers: Record<
        typeof collection,
        () => Promise<{updated: number}>
      > = {
        anomaly_records: () =>
          this.anomalyRepository.bulkConvertIds(BATCH_SIZE),
        genAI_jobs: () => this.genAIRepository.bulkConvertIds(BATCH_SIZE),
        invites: () => this.inviteRepo.bulkConvertIds(BATCH_SIZE),
        itemsGroup: () => this.itemRepo.bulkConvertIds(BATCH_SIZE),
        job_task_status: () =>
          this.genAIRepository.bulkConvertTaskIds(BATCH_SIZE),
        newCourse: () => this.courseRepo.bulkConvertIds(BATCH_SIZE),
        newCourseVersion: () =>
          this.courseRepo.bulkConvertVersionIds(BATCH_SIZE),
        questionBanks: () =>
          this.questionBankRepository.bulkConvertIds(BATCH_SIZE),
        quiz_submission_results: () =>
          this.submissionRepo.bulkConvertIds(BATCH_SIZE),
        quizzes: () => this.quizRepo.bulkConvertIds(BATCH_SIZE),
        user_quiz_metrics: () =>
          this.userQuizMetricsRepo.bulkConvertIds(BATCH_SIZE),
        quiz_attempts: () => this.attemptRepo.bulkConvertIds(BATCH_SIZE),
      };

      const handler = handlers[collection];

      if (!handler) {
        throw new InternalServerError(
          `No bulk conversion handler for ${collection}`,
        );
      }

      await handler();
      console.log(`Completed bulk ID conversion for ${collection}`);
    } catch (error) {
      throw new InternalServerError(
        `Failed to bulk update ${collection}. Error: ${error}`,
      );
    }
  }
  async getNonStudentEnrollmentsByCourseVersion(
    courseId: string,
    courseVersionId: string,
  ): Promise<IEnrollment[]> {
    return this._withTransaction(async (session: ClientSession) => {
      return await this.enrollmentRepo.getNonStudentEnrollmentsByCourseVersion(
        courseId,
        courseVersionId,
        session,
      );
    });
  }
  async bulkEnrollUsers(
    existingEnrolledUsersWithRoles: {userId: string; role: EnrollmentRole}[],
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
      console.log('Course version: ', courseVersion, courseId);
      if (!courseVersion || courseVersion.courseId.toString() !== courseId) {
        throw new NotFoundError(
          'Course version not found or does not belong to this course',
        );
      }

      const enrollmentsToCreate: OptionalId<IEnrollment>[] = [];
      const results: any[] = [];

      for (const {userId, role} of existingEnrolledUsersWithRoles) {
        const userExists = await this.userRepo.findById(userId, session);

        if (!userExists) {
          results.push({userId, error: 'User not found'});
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
}
