import {COURSES_TYPES} from '#courses/types.js';
import {InviteStatus} from '#root/modules/notifications/index.js';
import {BaseService} from '#root/shared/classes/BaseService.js';
import {ICourseRepository} from '#root/shared/database/interfaces/ICourseRepository.js';
import {IItemRepository} from '#root/shared/database/interfaces/IItemRepository.js';
import {IUserRepository} from '#root/shared/database/interfaces/IUserRepository.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {
  courseVersionStatus,
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
  NotFoundError,
  InternalServerError,
  ForbiddenError,
} from 'routing-controllers';
import { ProgressService } from './ProgressService.js';
import {
  ProgressRepository,
  InviteRepository,
  SettingRepository,
  ISettingRepository,
} from '#root/shared/index.js';
import { EnrollmentDataResponse } from '../classes/index.js';
import {
  QuizScoresExportResponseDto,
  StudentQuizScoreDto,
} from '../dtos/QuizScoresExportDto.js';
import {COURSE_REGISTRATION_TYPES} from '#root/modules/courseRegistration/types.js';
import {ICourseRegistrationRepository} from '#root/shared/database/interfaces/ICourseRegistrationRepository.js';
import {
  IGradingResult,
  ISubmission,
} from '#root/modules/quizzes/interfaces/index.js';
import {Cohort} from '#root/modules/courses/classes/index.js';
import { SETTING_TYPES } from '#root/modules/setting/types.js';

const GURU_SETU_COURSE_ID = '6981df886e100cfe04f9c4ad';
const GURU_SETU_VERSION_ID = '6981df886e100cfe04f9c4ae';

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
    @inject(SETTING_TYPES.SettingRepo)
    private readonly settingsRepository: ISettingRepository,
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
    cohort?: string,
    policyAcknowledged?: boolean,
    session?: ClientSession,
  ) {
    // const versionStatus=await this.courseRepo.getCourseVersionStatus(courseVersionId,session);

    // if(versionStatus==="archived"){
    //   throw new ForbiddenError("This enrollment is invalid. Because course version is archived.");
    // }
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

      // Check if version is archived (only for existing versions, not newly created ones)
      if (courseVersion.versionStatus === 'archived') {
        throw new ForbiddenError(
          'This enrollment is invalid. Because course version is archived.',
        );
      }

      const existingEnrollment = await this.enrollmentRepo.findActiveEnrollment(
        userId,
        courseId,
        courseVersionId,
        cohort,
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
      const versionSetting = await this.settingsRepository.getSettingsByVersionIds([new ObjectId(courseVersionId)]);
      const baseHpValue = versionSetting?.[0]?.settings?.hpSystem === true ? versionSetting?.[0]?.settings?.baseHp ?? 0 : 0;
      const enrollmentData = {
        userId: new ObjectId(userId),
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
        role: role,
        status: 'ACTIVE' as EnrollmentStatus,
        enrollmentDate: new Date(),
        percentCompleted: 0,
        completedItemsCount: 0,
        ...(cohort ? {cohortId: new ObjectId(cohort)} : {}),
        ...(policyAcknowledged ? {policyAcknowledgedAt: new Date()} : {}),
        ...(role === 'STUDENT' ? { hpPoints: baseHpValue } : {})
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
          cohort,
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
              ...(cohort ? { cohortId: new ObjectId(cohort) } : {}),
            },
            session,
          );
        } else {
          // No progress data returned - course may have no valid items
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
    cohort?: string,
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
        cohort,
      );
      // if (!existingEnrollment) {
      //   throw new Error('User is not enrolled in this course version');
      // }

      return existingEnrollment;
    });
  }

  async findAnyEnrollment(
    userId: string,
    courseId: string,
    courseVersionId: string,
    cohort?: string,
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
      const existingEnrollment = await this.enrollmentRepo.findAnyEnrollment(
        userId,
        courseId,
        courseVersionId,
        cohort,
        session,
      );

      return existingEnrollment;
    });
  }

  async findActiveEnrollment(
    userId: string,
    courseId: string,
    courseVersionId: string,
    cohort?: string,
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
      let existingEnrollment = await this.enrollmentRepo.findActiveEnrollment(
        userId,
        courseId,
        courseVersionId,
        cohort,
        session,
      );

      if (!existingEnrollment && !cohort) {
        const activeEnrollments =
          await this.enrollmentRepo.findActiveEnrollmentsByContext(
            userId,
            courseId,
            courseVersionId,
            session,
          );

        if (activeEnrollments.length === 1) {
          const resolvedCohortId = activeEnrollments[0]?.cohortId?.toString();
          existingEnrollment = await this.enrollmentRepo.findActiveEnrollment(
            userId,
            courseId,
            courseVersionId,
            resolvedCohortId,
            session,
          );
        }
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
      const versionStatus = await this.courseRepo.getCourseVersionStatus(
        courseVersionId,
        session,
      );

      if (versionStatus === 'archived') {
        throw new ForbiddenError(
          'This course version is archived, cannot unenroll users',
        );
      }
      if (!enrollment) {
        throw new NotFoundError('Enrollment not found');
      }

      await this.progressService.unenrollUser(
        userId,
        courseId,
        courseVersionId,
        enrollment?._id.toString(),
        enrollment?.cohortId?.toString(),
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
    cohortId?: string,
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

    const versionStatus =
      await this.courseRepo.getCourseVersionStatus(courseVersionId);

    if (versionStatus === 'archived') {
      throw new ForbiddenError(
        'This course version is archived, cannot unenroll users',
      );
    }
    // Process unenrollments in parallel with error handling
    await Promise.allSettled(
      userIds.map(async userId => {
        try {
          const enrollment = await this.findActiveEnrollment(
            userId,
            courseId,
            courseVersionId,
            cohortId,
          );

          if (!enrollment) {
            results.failureCount++;
            results.errors.push(`User ${userId}: No active enrollment found`);
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

  async updateStatus(
    userId: string,
    courseId: string,
    versionId: string,
    status: EnrollmentStatus,
    cohortId?: string,
  ) {
    return this._withTransaction(async (session: ClientSession) => {
      const enrollment = await this.enrollmentRepo.findAnyEnrollment(
        userId,
        courseId,
        versionId,
        cohortId,
        session,
      );

      if (!enrollment) {
        throw new NotFoundError('Enrollment not found');
      }

      await this.enrollmentRepo.updateEnrollmentStatus(
        enrollment._id!.toString(),
        status,
        session,
      );

      return {
        enrollment: {
          ...enrollment,
          status,
          isDeleted: enrollment.isDeleted ?? false,
        },
      };
    });
  }

  async bulkUpdateStatus(
    userIds: string[],
    courseId: string,
    versionId: string,
    status: EnrollmentStatus,
    cohortId?: string,
  ) {
    return this._withTransaction(async (session: ClientSession) => {
      await this.enrollmentRepo.bulkUpdateEnrollmentStatus(
        courseId,
        versionId,
        userIds,
        status,
        cohortId,
        session,
      );

      return {
        success: true,
        updatedCount: userIds.length,
      };
    });
  }

  private filterCourseVersions(course: any, enrolledVersionIds: Set<string>) {
    return {
      ...course,
      versions: course?.versions
        ? course.versions
            .map((versionId: any) => {
              // Convert ObjectId to string if needed
              const versionIdStr = versionId.toString
                ? versionId.toString()
                : versionId;
              return enrolledVersionIds.has(versionIdStr) ? versionIdStr : null;
            })
            .filter(Boolean) // Remove null values
        : [],
    };
  }

  public async getEnrollments(
    userId: string,
    skip: number,
    limit: number,
    role: EnrollmentRole,
    search: string,
    tab?: courseVersionStatus,
  ): Promise<EnrollmentDataResponse[]> {
    let enrollments = [];
    if (role === 'INSTRUCTOR') {
      enrollments = await this.enrollmentRepo.getBasicInstructorEnrollments(
        userId,
        skip,
        limit,
        role,
        search,
        tab,
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

      //Filtering Active versions enrollments
      const activeVersionIds = new Set(
        courseVersions.map(v => v._id.toString()),
      );

      const activeEnrollments = enrollments.filter(enr =>
        activeVersionIds.has(enr.courseVersionId.toString()),
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

      const courseVersionIds: ObjectId[] = activeEnrollments.map(enr =>
        enr.courseVersionId,
      );
      const courseSettings =
        await this.settingsRepository.getSettingsByVersionIds(courseVersionIds);

      const hpSystemMap = new Map(
        courseSettings.map(s => [
          s.courseVersionId.toString(),
          s.settings?.hpSystem ?? false,
        ]),
      );

      const quizInfo = await this.itemRepo.getQuizInfo(allItemGroupIds);

      // Extract actual quiz item IDs from quizInfo
      const allQuizIds = quizInfo
        .filter(quiz => quiz.items?._id)
        .map(quiz => quiz.items._id.toString());

      const watchedKeys = enrollments.map(e => ({
        userId: new ObjectId(userId),
        courseId: new ObjectId(e.courseId),
        courseVersionId: new ObjectId(e.courseVersionId),
        cohortId: e.cohortId,
      }));

      const [watchedItemsMap, /*watchedItemsByTypeMap, quizSubmissionGrades*/]: [
        Map<string, number>,
        // Map<
        //   string,
        //   {videos: number; quizzes: number; articles: number; projects: number}
        // >,
        // ISubmission[],
      ] = await Promise.all([
        this.enrollmentRepo.getWatchedItemCountsBatch(watchedKeys),
        // this.enrollmentRepo.getWatchedItemCountsByTypeBatch(watchedKeys),
        // allQuizIds.length > 0
        //   ? this.enrollmentRepo.getQuizSubmissionGrade(userId, allQuizIds)
        //   : Promise.resolve([]),
      ]);

      // const quizGradeMap: Map<string, IGradingResult> = new Map(
      //   quizSubmissionGrades.map(grade => [
      //     grade.quizId.toString(),
      //     grade.gradingResult,
      //   ]),
      // );

      return activeEnrollments.map(enr => {
        const versionIdStr = enr.courseVersionId.toString();
        const watchedKey = `${userId}-${enr.courseId.toString()}-${versionIdStr}-${enr.cohortId?.toString() || ''}`;

        // const versionItemGroups = versionToItemGroups.get(versionIdStr) || [];
        // const versionQuizIds = quizInfo.filter(quiz =>
        //   versionItemGroups.includes(quiz._id.toString()),
        // );
        // const enrollmentQuizGrades = versionQuizIds
        //   .map(q =>
        //     q.items?._id ? quizGradeMap.get(q.items._id.toString()) : null,
        //   )
        //   .filter(Boolean) as IGradingResult[];

        const completedCount = watchedItemsMap.get(watchedKey) || 0;
        // const completedByType = watchedItemsByTypeMap.get(watchedKey) || {
        //   videos: 0,
        //   quizzes: 0,
        //   articles: 0,
        //   projects: 0,
        // };
        // const itemCounts = enr.courseVersion?.itemCounts || {};
        const ratio = completedCount / (enr.totalItems || 1);
        // const calculatedPercent = Number((ratio * 100).toFixed(2));
        const hpSystem = hpSystemMap.get(versionIdStr) ?? false;

        // if (enr.percentCompleted !== calculatedPercent) {
        //   void this.enrollmentRepo.updateProgressPercentById(
        //     enr._id.toString(),
        //     calculatedPercent,
        //     completedCount,
        //     enr.cohortId?.toString(),
        //   );
        //   enr.percentCompleted = calculatedPercent;
        //   enr.completedItemsCount = completedCount;
        // }

        if (enr.percentCompleted >= 0) {
          return {
            _id: enr._id.toString(),
            courseId: enr.courseId.toString(),
            courseVersionId: versionIdStr,
            role: enr.role,
            status: enr.status,
            enrollmentDate: new Date(enr.enrollmentDate),
            assignedTimeSlot: enr.assignedTimeSlots,
            course: this.filterCourseVersions(enr.course, enrolledVersionIds),
            percentCompleted: enr.percentCompleted || 0,
            moduleNumber: enr.moduleNumber,
            sectionNumber: enr.sectionNumber,
            itemType: enr.itemType,
            contentCounts: {
              totalItems: enr.totalItems ?? 0,
            },
            cohortId: enr.cohortId?.toString(),
            cohortName: enr.cohortName,
            completedItems: watchedItemsMap.get(watchedKey) || 0,
            hasNewItemsAfterCompletion: enr.hasNewItemsAfterCompletion || false,
            policyReacknowledgementRequired:
              enr.policyReacknowledgementRequired ?? false,
            hpSystem,
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
      assignedTimeSlot: enr.assignedTimeSlots,
      course: this.filterCourseVersions(enr.course, enrolledVersionIds),
    }));
  }

  public async getActiveCount(
    userId: string,
    role: EnrollmentRole,
  ): Promise<number> {
    if (role === 'STUDENT') {
      return 0;
    }
    return await this.enrollmentRepo.getActiveCount(userId, role);
  }

  public async getArchiveCount(
    userId: string,
    role: EnrollmentRole,
  ): Promise<number> {
    if (role === 'STUDENT') {
      return 0;
    }
    return await this.enrollmentRepo.getArchiveCount(userId, role);
  }

  public async getDetailedEnrollment(
    userId: string,
    role: EnrollmentRole,
    courseVersionId?: string,
  ): Promise<EnrollmentDataResponse[]> {
    let enrollments = [];

    enrollments = await this.enrollmentRepo.getDetailedEnrollment(
      userId,
      role,
      courseVersionId,
    );

    if (!enrollments.length) return [];

    //  If courseVersionId is provided, filter to only that version
    if (courseVersionId) {
      enrollments = enrollments.filter(
        e => e.courseVersionId.toString() === courseVersionId,
      );
    }

    const enrolledVersionIds: Set<string> = new Set(
      enrollments.map(e => e.courseVersionId.toString()),
    );

    if (role === 'STUDENT') {
      const courseVersions = await this.courseRepo.getActiveVersions(
        Array.from(enrolledVersionIds),
      );
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

      // Extract actual quiz item IDs from quizInfo
      const allQuizIds = quizInfo
        .filter(quiz => quiz.items?._id)
        .map(quiz => quiz.items._id.toString());

      const watchedKeys = enrollments.map(e => ({
        userId: new ObjectId(userId),
        courseId: new ObjectId(e.courseId),
        courseVersionId: new ObjectId(e.courseVersionId),
        ...(e.cohortId ? { cohortId: new ObjectId(e.cohortId) } : {}),
      }));

      // Batch all async operations together
      const [watchedItemsMap, watchedItemsByTypeMap, quizSubmissionGrades]: [
        Map<string, number>,
        Map<
          string,
          {videos: number; quizzes: number; articles: number; projects: number}
        >,
        ISubmission[],
      ] = await Promise.all([
        this.enrollmentRepo.getWatchedItemCountsBatch(watchedKeys),
        this.enrollmentRepo.getWatchedItemCountsByTypeBatch(watchedKeys),
        allQuizIds.length > 0
          ? this.enrollmentRepo.getQuizSubmissionGrade(userId, allQuizIds)
          : Promise.resolve([]),
      ]);
      const quizGradeMap: Map<string, IGradingResult> = new Map(
        quizSubmissionGrades.map(grade => [
          grade.quizId.toString(),
          grade.gradingResult,
        ]),
      );

      const itemCountsFallbackCache = new Map<
        string,
        { totalItems: number; itemCounts: Record<string, number> }
      >();

      const detailedEnrollments = await Promise.all(enrollments.map(async enr => {
        const versionIdStr = enr.courseVersionId.toString();
        const watchedKey = `${userId}-${enr.courseId.toString()}-${versionIdStr}-${enr.cohortId?.toString() || ''}`;
        const versionItemGroups = versionToItemGroups.get(versionIdStr) || [];
        const versionQuizIds = quizInfo.filter(quiz =>
          versionItemGroups.includes(quiz._id.toString()),
        );

        const enrollmentQuizGrades = versionQuizIds
          .map(q =>
            q.items?._id ? quizGradeMap.get(q.items._id.toString()) : null,
          )
          .filter(Boolean) as IGradingResult[];

        const completedCount = watchedItemsMap.get(watchedKey) || 0;

        const ratio = completedCount / (enr.totalItems || 1);
        let calculatedPercent = Number((ratio * 100).toFixed(2));
        let totalCompletedItemsCount = completedCount;

        // Guru Setu Override
        // console.log(`Checking Guru Setu for course ${enr.courseId?.toString()} and version ${versionIdStr}`);
        if (enr.courseId?.toString() === GURU_SETU_COURSE_ID && versionIdStr === GURU_SETU_VERSION_ID) {
          // console.log(`Guru Setu Match Found for user ${userId}`);
          const guruProgress = await this.progressService.calculateGuruSetuProgress(userId, versionIdStr);
          calculatedPercent = guruProgress.percentCompleted;
          totalCompletedItemsCount = guruProgress.completedItemsCount;
        }

        // if (enr.percentCompleted !== calculatedPercent) {
        //   void this.enrollmentRepo.updateProgressPercentById(
        //     enr._id.toString(),
        //     calculatedPercent,
        //     totalCompletedItemsCount,
        //     enr.cohortId?.toString(),
        //   );

        //   enr.percentCompleted = calculatedPercent;
        //   enr.completedItemsCount = totalCompletedItemsCount;
        // }

        if (enr.percentCompleted >= 0) {
          let itemCounts = enr.itemCounts || {};
          let totalItems = Number(enr.totalItems ?? 0);

          const hasItemCounts =
            Object.values(itemCounts).some((count: any) => Number(count) > 0);

          if (totalItems <= 0 || !hasItemCounts) {
            if (!itemCountsFallbackCache.has(versionIdStr)) {
              const fallback =
                await this.itemRepo.calculateItemCountsForVersion(versionIdStr);
              itemCountsFallbackCache.set(versionIdStr, {
                totalItems: Number(fallback.totalItems ?? 0),
                itemCounts: fallback.itemCounts ?? {},
              });
            }

            const fallback = itemCountsFallbackCache.get(versionIdStr)!;
            if (totalItems <= 0) {
              totalItems = fallback.totalItems;
            }
            if (!hasItemCounts) {
              itemCounts = fallback.itemCounts;
            }
          }

          const completedByType = watchedItemsByTypeMap.get(watchedKey) || {
            videos: 0,
            quizzes: 0,
            articles: 0,
            projects: 0,
          };

          return {
            _id: enr._id.toString(),
            courseId: enr.courseId.toString(),
            courseVersionId: versionIdStr,
            role: enr.role,
            status: enr.status,
            enrollmentDate: new Date(enr.enrollmentDate),
            course: this.filterCourseVersions(enr.course, enrolledVersionIds),
            // courseVersion: enr.courseVersion,
            percentCompleted: enr.percentCompleted || 0,
            assignedTimeSlot: enr.assignedTimeSlots,
            moduleNumber: enr.moduleNumber,
            sectionNumber: enr.sectionNumber,
            itemType: enr.itemType,
            contentCounts: {
              totalItems,
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
      }));

      return detailedEnrollments.filter(Boolean);
    }
  }
  async detailedCountEnrollment(
    userId: string,
    role: EnrollmentRole,
    courseVersionId?: string,
  ) {
    return this._withTransaction(async (session: ClientSession) => {
      const result = await this.enrollmentRepo.detailedCountEnrollment(
        userId,
        role,
        courseVersionId,
      );
      return result;
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
    sortBy: 'name' | 'enrollmentDate' | 'progress' | 'unenrolledAt',
    sortOrder: 'asc' | 'desc',
    filter: string,
    statusTab: 'ACTIVE' | 'INACTIVE' = 'ACTIVE',
    cohort?: string,
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
          cohort,
          (courseVersion.cohorts || []).map(cohort => new ObjectId(cohort)),
          session,
        );
      return enrollmentsData;
    });
  }

  /**
   * API 2: Get detailed progress summary for a single student.
   * Called when instructor opens the "View Progress" modal.
   */
  async getStudentProgressDetail(
    userId: string,
    courseId: string,
    courseVersionId: string,
    cohortId?: string,
  ) {
    return this._withTransaction(async (session: ClientSession) => {
      const detail = await this.enrollmentRepo.getStudentProgressDetail(
        userId,
        courseId,
        courseVersionId,
        cohortId,
        session,
      );
      if (!detail) return null;

      const completedItemsCount = Number(detail?.completedItemsCount ?? 0);

      const existingContentCounts = detail?.contentCounts ?? {};
      const existingItemCounts = existingContentCounts.itemCounts ?? {};
      let resolvedItemCounts: Record<string, number> = {
        VIDEO: Number(
          existingItemCounts.VIDEO ??
          existingItemCounts.video ??
          existingItemCounts.videos ??
          0,
        ),
        QUIZ: Number(
          existingItemCounts.QUIZ ??
          existingItemCounts.quiz ??
          existingItemCounts.quizzes ??
          0,
        ),
        BLOG: Number(
          existingItemCounts.BLOG ??
          existingItemCounts.blog ??
          existingItemCounts.article ??
          existingItemCounts.articles ??
          0,
        ),
        PROJECT: Number(
          existingItemCounts.PROJECT ??
          existingItemCounts.project ??
          existingItemCounts.projects ??
          0,
        ),
        FEEDBACK: Number(
          existingItemCounts.FEEDBACK ??
          existingItemCounts.feedback ??
          existingItemCounts.feedbacks ??
          0,
        ),
      };
      let resolvedTotalItems = Number(existingContentCounts.totalItems ?? 0);

      const hasResolvedItemCounts =
        Object.values(resolvedItemCounts).some(count => count > 0);

      const shouldRecalculateItemCounts =
        resolvedTotalItems <= 0 || !hasResolvedItemCounts;

      if (shouldRecalculateItemCounts) {
        const { totalItems, itemCounts } =
          await this.itemRepo.calculateItemCountsForVersion(
            courseVersionId,
            session,
          );

        const normalizedCalculatedCounts = {
          VIDEO: Number(itemCounts?.VIDEO ?? 0),
          QUIZ: Number(itemCounts?.QUIZ ?? 0),
          BLOG: Number(itemCounts?.BLOG ?? 0),
          PROJECT: Number(itemCounts?.PROJECT ?? 0),
          FEEDBACK: Number(itemCounts?.FEEDBACK ?? 0),
        };

        if (resolvedTotalItems <= 0) {
          resolvedTotalItems = Number(totalItems ?? 0);
        }

        resolvedItemCounts = normalizedCalculatedCounts;
      }

      // Enrich with quiz scores for this student only
      const courseVersion = await this.courseRepo.readVersion(courseVersionId);
      let totalQuizScore = 0;
      let totalQuizMaxScore = 0;
      const totalItems =
        resolvedTotalItems > 0
          ? resolvedTotalItems
          : Number(courseVersion?.totalItems ?? 0);

      if (courseVersion) {
        const itemGroupIds: string[] = [];
        courseVersion.modules.forEach((module: any) => {
          module.sections.forEach((section: any) => {
            if (section.itemsGroupId) {
              itemGroupIds.push(section.itemsGroupId.toString());
            }
          });
        });

        if (itemGroupIds.length > 0) {
          const quizInfo = await this.itemRepo.getQuizInfo(itemGroupIds);
          const allQuizIds = quizInfo
            .filter((quiz: any) => quiz.items?._id)
            .map((quiz: any) => quiz.items._id.toString());

          if (allQuizIds.length > 0) {
            const quizSubmissions =
              await this.enrollmentRepo.getBatchQuizSubmissionGrades(
                [userId],
                allQuizIds,
                cohortId ? [cohortId] : undefined
              );

            quizSubmissions.forEach((submission: any) => {
              const gradingResult = submission.gradingResult;
              totalQuizScore += gradingResult.totalScore || 0;
              totalQuizMaxScore += gradingResult.totalMaxScore || 0;
            });
          }
        }
      }

      let currentPercentCompleted = Number(detail?.percentCompleted ?? 0);
      let currentCompletedItemsCount = completedItemsCount;

      if (courseId?.toString() === GURU_SETU_COURSE_ID && courseVersionId?.toString() === GURU_SETU_VERSION_ID) {
        const guruProgress = await this.progressService.calculateGuruSetuProgress(userId, courseVersionId);
        currentPercentCompleted = guruProgress.percentCompleted;
        currentCompletedItemsCount = guruProgress.completedItemsCount;
      }

      return {
        ...detail,
        contentCounts: {
          totalItems,
          itemCounts: resolvedItemCounts,
        },
        completedItemsCount: currentCompletedItemsCount,
        percentCompleted: currentPercentCompleted,
        totalQuizScore,
        totalQuizMaxScore,
      };
    });
  }

  /**
   * API 3: Get the current learning position and course structure for a student.
   * Called when instructor clicks "View Course Structure" (lazy load).
   */
  async getStudentCourseStructure(
    userId: string,
    courseId: string,
    courseVersionId: string,
    cohortId?: string,
  ) {
    return this._withTransaction(async (session: ClientSession) => {
      return this.enrollmentRepo.getStudentCourseStructure(
        userId,
        courseId,
        courseVersionId,
        cohortId,
        session,
      );
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

    // 4. Batch fetch quiz submissions for all users
    const quizSubmissions =
      await this.enrollmentRepo.getBatchQuizSubmissionGrades(
        userIds,
        allQuizIds,
        enrollments.filter(e => e.cohortId).map(e => e.cohortId?.toString()),
      );
    // 5. Create a map: userId -> quiz grades
    const userQuizGradesMap = new Map<string, IGradingResult[]>();

    quizSubmissions.forEach(submission => {
      const key = `${submission.userId}-${submission.cohortId}`;
      const gradingResult = submission.gradingResult;

      if (!userQuizGradesMap.has(key)) {
        userQuizGradesMap.set(key, []);
      }

      userQuizGradesMap.get(key)!.push(gradingResult);
    });

    // 6. Enrich each enrollment with scores
    enrollments.forEach(enr => {
      // const userId = enr.userId;
      // const userGrades = userQuizGradesMap.get(userId) || [];
      const key = `${enr.userId}-${enr.cohortId}`;
      const userGrades = userQuizGradesMap.get(key) || [];

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
    cohortId?: string,
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

      let cohorts;
      let cohortMap;
      let cohortIds: string[] = [];

      if (version.cohorts && version.cohorts.length > 0) {
        // If a specific cohort is provided, only get that cohort
        if (cohortId) {
          // Validate that the cohort exists in this version
          if (!version.cohorts.some(id => id.toString() === cohortId)) {
            throw new NotFoundError('Cohort not found in this course version');
          }
          cohortIds = [cohortId];
          cohorts = await this.courseRepo.getCohortsByIds(cohortIds);
        } else {
          // Get all cohorts for the version
          cohortIds = version.cohorts.map(id => id.toString());
          cohorts = await this.courseRepo.getCohortsByIds(cohortIds);
        }
        cohortMap = new Map(cohorts.map(c => [c._id.toString(), c.name]));
      }

      // Get quiz scores from repository with batching
      return await this.enrollmentRepo.getQuizScoresForCourseVersion(
        courseId,
        versionId,
        cohortIds,
        cohortMap,
        statusTab,
      );
      // console.log("----retruning from getQuizScoresForCourseVersion service--", result);
      // return result;
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

  async countEnrollments(
    userId: string,
    role: EnrollmentRole,
    tab: courseVersionStatus,
    search?: string,
    courseVersionId?: string,
  ) {
    return this._withTransaction(async (session: ClientSession) => {
      const result = await this.enrollmentRepo.countEnrollments(
        userId,
        role,
        tab,
        search,
        courseVersionId,
      );
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
    const versionStatus = await this.courseRepo.getCourseVersionStatus(
      invite.courseVersionId.toString(),
    );

    if (versionStatus === 'archived') {
      throw new ForbiddenError(
        'Cannot process invites. Because course version is archived.',
      );
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
      const versionStatus =
        await this.courseRepo.getCourseVersionStatus(versionId);

      if (versionStatus === 'archived') {
        throw new ForbiddenError(
          "Can'not recalculate progress. Because course version is archived.",
        );
      }

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
  ): Promise<{totalCount: number; updatedCount: number}> {
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
            let currentCompletedItems =
              await this.progressService.getUserProgressPercentageWithoutTotal(
                enrollment.userId.toString(),
                courseVersion.courseId.toString(),
                courseVersion._id.toString(),
              );

            let currentPercentCompleted = Math.round(
              (totalItems > 0 ? currentCompletedItems / totalItems : 0) * 100,
            );

            // Guru Setu Override
            if (courseVersion.courseId.toString() === GURU_SETU_COURSE_ID && courseVersion._id.toString() === GURU_SETU_VERSION_ID) {
              const guruProgress = await this.progressService.calculateGuruSetuProgress(
                enrollment.userId.toString(),
                courseVersion._id.toString(),
              );
              currentPercentCompleted = guruProgress.percentCompleted;
              currentCompletedItems = guruProgress.completedItemsCount;
            }

            bulkOperations.push({
              updateOne: {
                filter: {_id: new ObjectId(enrollment._id)},
                update: {
                  $set: {
                    percentCompleted: currentPercentCompleted,
                    completedItemsCount: currentCompletedItems,
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
                // Batch ${++batchCount}: Updated ${bulkOperations.length} enrollments
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
    existingEnrolledUsersWithRoles: {userId: string; role: EnrollmentRole}[],
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ) {
    const execute = async (session: ClientSession) => {
      const versionStatus = await this.courseRepo.getCourseVersionStatus(
        courseVersionId,
        session,
      );

      if (versionStatus === 'archived') {
        throw new ForbiddenError(
          'This enrollment is invalid. Because course version is archived.',
        );
      }
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

      for (const {userId, role} of existingEnrolledUsersWithRoles) {
        const userExists = await this.userRepo.findById(userId, session);

        if (!userExists) {
          results.push({userId, error: 'User not found'});
          continue;
        }
        const existingEnrollment =
          await this.enrollmentRepo.findActiveEnrollment(
            userId,
            courseId,
            courseVersionId,
            null,
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
          cohort: '',
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
    cohortId?: string,
  ): Promise<IEnrollment | null> {
    return this._withTransaction(async (session: ClientSession) => {
      return this.enrollmentRepo.getUserEnrollmentsByCourseVersion(
        userId,
        courseId,
        courseVersionId,
        cohortId,
        session,
      );
    });
  }

  async bulkUpdateCompletedItemsCountParallelPerCourseVersion(
    courseId?: string,
    versionId?: string,
    userId?: string,
  ): Promise<{totalCount: number; updatedCount: number}> {
    const MAX_CONCURRENCY = 4;

    if (versionId) {
      if (versionId === GURU_SETU_VERSION_ID) {
        return this.bulkUpdateGuruSetuProgress(courseId, versionId, userId);
      }
      const result = await this.enrollmentRepo.bulkUpdateCompletedItemsCountForCourseVersion(
        { courseVersionId: versionId, courseId, userId },
      );
      return result;
    }

    const courses = courseId
      ? [await this.courseRepo.read(courseId)]
      : await this.courseRepo.getAllCourses();

    if (!courses.length || courses.some(c => !c)) {
      throw new Error('Course not found');
    }

    const courseVersionIds = courses.flatMap(c =>
      c.versions.map(v => v.toString()),
    );

    let index = 0;
    const results: {totalCount: number; updatedCount: number}[] = [];

    const worker = async () => {
      while (index < courseVersionIds.length) {
        const currentIndex = index++;
        const courseVersionId = courseVersionIds[currentIndex];

        if (courseVersionId === GURU_SETU_VERSION_ID) {
          const result = await this.bulkUpdateGuruSetuProgress(courseId, courseVersionId, userId);
          results.push(result);
          continue;
        }

        const result =
          await this.enrollmentRepo.bulkUpdateCompletedItemsCountForCourseVersion(
            {courseVersionId, courseId, userId},
          );

        results.push(result);
      }
    };

    const workers = Array.from({length: MAX_CONCURRENCY}, () => worker());

    await Promise.all(workers);

    const totalCount = results.reduce((sum, r) => sum + r.totalCount, 0);
    const updatedCount = results.reduce((sum, r) => sum + r.updatedCount, 0);

    return {totalCount, updatedCount};
  }

  /**
   * Bulk updates progress for Guru Setu students using feedback-based logic.
   */
  private async bulkUpdateGuruSetuProgress(
    courseId?: string,
    versionId?: string,
    userId?: string,
  ): Promise<{ totalCount: number; updatedCount: number }> {
    const filter: any = {
      courseVersionId: new ObjectId(GURU_SETU_VERSION_ID),
      role: 'STUDENT',
      isDeleted: { $ne: true },
    };
    if (userId) filter.userId = new ObjectId(userId);
    if (courseId) filter.courseId = new ObjectId(GURU_SETU_COURSE_ID);

    const enrollments = await this.enrollmentRepo.findEnrollments(filter);
    
    let updatedCount = 0;
    for (const enr of enrollments) {
      try {
        const userIdStr = enr.userId.toString();
        const guruProgress = await this.progressService.calculateGuruSetuProgress(userIdStr, GURU_SETU_VERSION_ID);
        
        await this.enrollmentRepo.updateProgressPercentById(
          enr._id.toString(),
          guruProgress.percentCompleted,
          guruProgress.completedItemsCount,
          enr.cohortId?.toString(),
        );
        updatedCount++;
      } catch (err) {
        console.error(`Failed to update Guru Setu progress for user ${enr.userId}:`, err);
      }
    }

    return { totalCount: enrollments.length, updatedCount };
  }

  async getModuleProgressForUser(
    userId: string,
    courseId: string,
    versionId: string,
    cohort?: string,
  ): Promise<
    Array<{
      moduleId: string;
      moduleName: string;
      totalItems: number;
      completedItems: number;
    }>
  > {
    // Delegate to ProgressService which already has working module progress logic
    return await this.progressService.getModuleWiseProgress(
      userId,
      courseId,
      versionId,
      cohort,
    );
  }

  /**
   * Update student's assigned time slot
   */
  async updateStudentTimeSlot(
    userId: string,
    courseId: string,
    courseVersionId: string,
    timeSlot: {from: string; to: string},
    session?: ClientSession,
  ): Promise<boolean> {
    const execute = async (session: ClientSession) => {
      const versionStatus = await this.courseRepo.getCourseVersionStatus(
        courseVersionId,
        session,
      );

      if (versionStatus === 'archived') {
        throw new ForbiddenError(
          'Cannot update time slot. Because course version is archived.',
        );
      }
      const enrollment = await this.enrollmentRepo.findActiveEnrollment(
        userId,
        courseId,
        courseVersionId,
        null,
        session,
      );

      if (!enrollment) {
        throw new NotFoundError('Enrollment not found for this student.');
      }

      const result = await this.enrollmentRepo.updateEnrollmentTimeSlot(
        enrollment._id?.toString(),
        timeSlot,
        session,
      );

      return !!result;
    };

    return session ? execute(session) : this._withTransaction(execute);
  }

  /**
   * Remove assigned time slot from student enrollment
   */
  async removeStudentTimeSlot(
    userId: string,
    courseId: string,
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<boolean> {
    const execute = async (session: ClientSession) => {
      const versionStatus = await this.courseRepo.getCourseVersionStatus(
        courseVersionId,
        session,
      );

      if (versionStatus === 'archived') {
        throw new ForbiddenError(
          'Can not remove time slot. Because course version is archived.',
        );
      }
      const enrollment = await this.enrollmentRepo.findActiveEnrollment(
        userId,
        courseId,
        courseVersionId,
        undefined,
        session,
      );

      if (!enrollment) {
        throw new NotFoundError('Enrollment not found for this student.');
      }

      const result = await this.enrollmentRepo.removeEnrollmentTimeSlot(
        enrollment._id?.toString(),
        undefined,
        session,
      );

      return !!result;
    };

    return session ? execute(session) : this._withTransaction(execute);
  }

  /**
   * Update time slots for multiple students (when time slot is modified)
   */
  async updateTimeSlotForStudents(
    userIds: string[],
    courseId: string,
    courseVersionId: string,
    oldTimeSlot: {from: string; to: string},
    newTimeSlot: {from: string; to: string},
    session?: ClientSession,
  ): Promise<boolean> {
    const execute = async (session: ClientSession) => {
      const versionStatus = await this.courseRepo.getCourseVersionStatus(
        courseVersionId,
        session,
      );

      if (versionStatus === 'archived') {
        throw new ForbiddenError(
          'Cannot update time slot. Because course version is archived.',
        );
      }
      const results = await Promise.all(
        userIds.map(async userId => {
          try {
            const enrollment = await this.enrollmentRepo.findActiveEnrollment(
              userId,
              courseId,
              courseVersionId,
              undefined,
              session,
            );

            if (!enrollment || !enrollment.assignedTimeSlots?.length) {
              return false;
            }

            const hasOldTimeSlot = enrollment.assignedTimeSlots.some(
              slot =>
                slot.from === oldTimeSlot.from && slot.to === oldTimeSlot.to,
            );

            if (!hasOldTimeSlot) {
              return false;
            }

            const result = await this.enrollmentRepo.updateSpecificTimeSlot(
              enrollment._id?.toString(),
              oldTimeSlot,
              newTimeSlot,
              session,
            );

            return !!result;
          } catch (error) {
            console.error(
              `Failed to update time slot for user ${userId}:`,
              error,
            );
            return false;
          }
        }),
      );

      return results.every(result => result);
    };

    return session ? execute(session) : this._withTransaction(execute);
  }

  /**
   * Find enrollments by assigned time slot
   */
  async findEnrollmentsByTimeSlot(
    courseId: string,
    courseVersionId: string,
    timeSlot: {from: string; to: string},
    session?: ClientSession,
  ): Promise<IEnrollment[]> {
    const execute = async (session: ClientSession) => {
      const enrollments = await this.enrollmentRepo.findEnrollmentsByTimeSlot(
        courseId,
        courseVersionId,
        timeSlot,
        session,
      );

      return enrollments;
    };

    return session ? execute(session) : this._withTransaction(execute);
  }

  /**
   * Update time slot (for modification scenarios)
   */
  async updateTimeSlot(
    courseId: string,
    courseVersionId: string,
    oldTimeSlot: {from: string; to: string},
    newTimeSlot: {from: string; to: string},
    session?: ClientSession,
  ): Promise<boolean> {
    const execute = async (session: ClientSession) => {
      const versionStatus = await this.courseRepo.getCourseVersionStatus(
        courseVersionId,
        session,
      );

      if (versionStatus === 'archived') {
        throw new ForbiddenError(
          'Cannot update time slot. Because course version is archived.',
        );
      }
      // Find all enrollments with the old time slot
      const enrollments = await this.findEnrollmentsByTimeSlot(
        courseId,
        courseVersionId,
        oldTimeSlot,
        session,
      );

      // Update each enrollment - replace old slot with new slot in one operation
      const results = await Promise.all(
        enrollments.map(async enrollment => {
          // Update the specific timeslot in the array
          const result = await this.enrollmentRepo.updateSpecificTimeSlot(
            enrollment._id?.toString(),
            oldTimeSlot,
            newTimeSlot,
            session,
          );
          return !!result;
        }),
      );

      // Return true if all updates succeeded
      return results.every(result => result);
    };

    return session ? execute(session) : this._withTransaction(execute);
  }

  /**
   * Add multiple time slots to a student's enrollment
   */
  async addMultipleTimeSlotsToStudent(
    userId: string,
    courseId: string,
    courseVersionId: string,
    timeSlots: Array<{from: string; to: string}>,
    session?: ClientSession,
  ): Promise<boolean> {
    const execute = async (session: ClientSession) => {
      // Check if course version is archived
      const versionStatus = await this.courseRepo.getCourseVersionStatus(
        courseVersionId,
        session,
      );
      if (versionStatus === 'archived') {
        throw new ForbiddenError(
          'Cannot add time slots. Because course version is archived.',
        );
      }

      // Find enrollment and add time slots
      const enrollment = await this.enrollmentRepo.findActiveEnrollment(
        userId,
        courseId,
        courseVersionId,
        null,
        session,
      );

      if (!enrollment) {
        throw new NotFoundError('Enrollment not found for this student.');
      }

      return !!(await this.enrollmentRepo.addMultipleTimeSlots(
        enrollment._id?.toString(),
        timeSlots,
        session,
      ));
    };

    return session ? execute(session) : this._withTransaction(execute);
  }

  /**
   * Remove specific time slot from student's enrollment
   */
  async removeSpecificTimeSlotFromStudent(
    userId: string,
    courseId: string,
    courseVersionId: string,
    timeSlot: {from: string; to: string},
    session?: ClientSession,
  ): Promise<boolean> {
    const execute = async (session: ClientSession) => {
      const versionStatus = await this.courseRepo.getCourseVersionStatus(
        courseVersionId,
        session,
      );

      if (versionStatus === 'archived') {
        throw new ForbiddenError(
          'Cannot remove time slot. Because course version is archived.',
        );
      }
      const enrollment = await this.enrollmentRepo.findActiveEnrollment(
        userId,
        courseId,
        courseVersionId,
        undefined,
        session,
      );

      if (!enrollment) {
        throw new NotFoundError('Enrollment not found for this student.');
      }

      const result = await this.enrollmentRepo.removeEnrollmentTimeSlot(
        enrollment._id?.toString(),
        timeSlot,
        session,
      );

      return !!result;
    };

    return session ? execute(session) : this._withTransaction(execute);
  }

  /**
   * Remove a single time slot from a student's enrollment
   */
  async removeSingleTimeSlotFromStudent(
    userId: string,
    courseId: string,
    courseVersionId: string,
    timeSlotToRemove: {from: string; to: string},
    session?: ClientSession,
  ): Promise<boolean> {
    const execute = async (session: ClientSession) => {
      const versionStatus = await this.courseRepo.getCourseVersionStatus(
        courseVersionId,
        session,
      );

      if (versionStatus === 'archived') {
        throw new ForbiddenError(
          'Cannot remove time slot. Because course version is archived.',
        );
      }

      const enrollment = await this.enrollmentRepo.findActiveEnrollment(
        userId,
        courseId,
        courseVersionId,
        undefined,
        session,
      );

      if (!enrollment) {
        throw new NotFoundError('Enrollment not found for this student.');
      }

      if (
        !enrollment.assignedTimeSlots ||
        enrollment.assignedTimeSlots.length === 0
      ) {
        throw new BadRequestError(
          'Student does not have any assigned time slots.',
        );
      }

      // Filter out the specific timeslot to remove
      const updatedTimeSlots = enrollment.assignedTimeSlots.filter(
        slot =>
          !(
            slot.from === timeSlotToRemove.from &&
            slot.to === timeSlotToRemove.to
          ),
      );

      // Update enrollment with filtered timeslots
      const result = await this.enrollmentRepo.replaceAllTimeSlots(
        enrollment._id?.toString(),
        updatedTimeSlots,
        session,
      );

      return !!result;
    };

    return session ? execute(session) : this._withTransaction(execute);
  }

  async flagNewItemsForCompletedStudents(
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<void> {
    await this.enrollmentRepo.flagCompletedEnrollmentsWithNewItems(
      courseVersionId,
      session,
    );
  }

  async enrollmentExists(
    versionId: string,
    cohortId: string,
    session: ClientSession,
  ): Promise<boolean> {
    return await this.enrollmentRepo.enrollmentExistsByCohortId(
      versionId,
      cohortId,
      session,
    );
  }

  async moveNonCohortStudentsToCohortInEnrollment(
    enrollmentIds: string[],
    courseId: string,
    versionId: string,
    cohortId: string,
  ): Promise<boolean> {
    return this._withTransaction(async (session: ClientSession) => {
      const result = await this.enrollmentRepo.moveEnrollmentsToCohort(
        enrollmentIds,
        courseId,
        versionId,
        cohortId,
        session,
      );

      if (result.modifiedCount !== enrollmentIds.length) {
        throw new BadRequestError(
          'Some enrollments are invalid or already assigned to a cohort',
        );
      }

      return true;
    });
  }

  // Move other documents realted to that student to the target cohort.
  async moveRelatedDocumentsToCohort(
    enrollmentIds: string[],
    courseId: string,
    versionId: string,
    targetCohortId: string,
  ): Promise<boolean> {
    return this._withTransaction(async (session: ClientSession) => {
      await this.enrollmentRepo.moveRelatedDocumentsToCohort(
        enrollmentIds,
        courseId,
        versionId,
        targetCohortId,
        session,
      );

      return true;
    });
  }
  async ejectUser(
    userId: string,
    courseId: string,
    courseVersionId: string,
    reason: string,
    ejectedBy: string,
    cohortId?: string,
    policyId?: string,
  ): Promise<{enrollment: IEnrollment}> {
    return this._withTransaction(async (session: ClientSession) => {
      const versionStatus = await this.courseRepo.getCourseVersionStatus(
        courseVersionId,
        session,
      );

      if (versionStatus === 'archived') {
        throw new ForbiddenError(
          'This course version is archived, cannot eject users',
        );
      }

      const enrollment = await this.enrollmentRepo.findActiveStudentEnrollment(
        userId,
        courseId,
        courseVersionId,
        cohortId,
        session,
      );

      if (!enrollment) {
        throw new NotFoundError(
          'No active enrollment found for this user in the specified course version',
        );
      }

      if ((enrollment as any).isEjected) {
        throw new BadRequestError(
          'This learner is already ejected from this course',
        );
      }

      // Only update the enrollment document — do NOT touch progress or watchtime
      const ejectedEnrollment = await this.enrollmentRepo.ejectEnrollment(
        enrollment._id.toString(),
        reason,
        ejectedBy,
        policyId,
        session,
      );

      if (!ejectedEnrollment) {
        throw new NotFoundError('Failed to eject enrollment');
      }

      return {enrollment: ejectedEnrollment};
    });
  }

  async getStudentsForEjectionPage(
    courseId: string,
    courseVersionId: string,
    cohortId: string,
    page: number,
    limit: number,
    search: string = '',
    statusFilter: 'all' | 'active' | 'ejected' = 'all',
  ): Promise<{students: any[]; totalDocuments: number; totalPages: number}> {
    const {students, totalDocuments} =
      await this.enrollmentRepo.getStudentsForEjectionPage(
        courseId,
        courseVersionId,
        cohortId,
        page,
        limit,
        search,
        statusFilter,
        // no session — read-only, no transaction needed
      );

    return {
      students,
      totalDocuments,
      totalPages: Math.ceil(totalDocuments / limit),
    };
  }

  async reinstateUser(
    userId: string,
    courseId: string,
    courseVersionId: string,
    reinstatedBy: string,
    cohortId?: string,
  ): Promise<{enrollment: IEnrollment}> {
    return this._withTransaction(async (session: ClientSession) => {
      const versionStatus = await this.courseRepo.getCourseVersionStatus(
        courseVersionId,
        session,
      );

      if (versionStatus === 'archived') {
        throw new ForbiddenError(
          'This course version is archived, cannot reinstate users',
        );
      }

      const enrollment = await this.enrollmentRepo.findEjectedEnrollment(
        userId,
        courseId,
        courseVersionId,
        cohortId,
        session,
      );

      if (!enrollment) {
        throw new NotFoundError(
          'No ejected enrollment found for this user in the specified course version',
        );
      }

      const reinstatedEnrollment =
        await this.enrollmentRepo.reinstateEnrollment(
          enrollment._id.toString(),
          reinstatedBy,
          session,
        );

      if (!reinstatedEnrollment) {
        throw new NotFoundError('Failed to reinstate enrollment');
      }

      return {enrollment: reinstatedEnrollment};
    });
  }
  async getCohortStaff(courseId: string, versionId: string, cohortId: string) {
    return this.enrollmentRepo.getCohortStaff(courseId, versionId, cohortId);
  }
  async getGlobalEjectionHistory(
    courseId: string,
    courseVersionId: string,
    params: {
      triggerType?: string;
      startDate?: Date;
      endDate?: Date;
      search?: string;
      page?: number;
      limit?: number;
      cohortId?: string;
      timezoneOffset?: number;
    },
  ): Promise<{history: any[]; totalDocuments: number; totalPages: number}> {
    const {history, totalDocuments} =
      await this.enrollmentRepo.getGlobalEjectionHistory(
        courseId,
        courseVersionId,
        params,
      );

    return {
      history,
      totalDocuments,
      totalPages: Math.ceil(totalDocuments / (params.limit || 10)),
    };
  }

  async exportEjectionHistoryCSV(
    courseId: string,
    courseVersionId: string,
    params: {
      triggerType?: string;
      startDate?: Date;
      endDate?: Date;
      search?: string;
      cohortId?: string;
    },
  ): Promise<string> {
    const {history} = await this.enrollmentRepo.getGlobalEjectionHistory(
      courseId,
      courseVersionId,
      {...params, page: 1, limit: 10000}, // Export all matching records
    );

    const {createObjectCsvStringifier} = await import('csv-writer');

    const header = [
      {id: 'firstName', title: 'First Name'},
      {id: 'lastName', title: 'Last Name'},
      {id: 'email', title: 'Email'},
      {id: 'cohortName', title: 'Cohort'},
      {id: 'type', title: 'Event Type'},
      {id: 'ejectedAt', title: 'Date'},
      {id: 'triggerType', title: 'Trigger Source'},
      {id: 'policyName', title: 'Policy Name'},
      {id: 'ejectionReason', title: 'Reason/Note'},
      {id: 'ejectedByName', title: 'Performed By'},
    ];

    const csvStringifier = createObjectCsvStringifier({
      header: header,
    });

    const formattedHistory = history.map(item => ({
      ...item,
      ejectedAt: item.ejectedAt
        ? new Date(item.ejectedAt).toLocaleString()
        : '',
      policyName: item.policyName || 'N/A',
      cohortName: item.cohortName || 'N/A',
      triggerType: item.triggerType || 'N/A',
    }));

    return (
      csvStringifier.getHeaderString() +
      csvStringifier.stringifyRecords(formattedHistory)
    );
  }
  async markPolicyReacknowledgementRequired(
    courseId: string,
    courseVersionId: string,
    cohortId: string,
  ): Promise<void> {
    await this.enrollmentRepo.markReacknowledgementRequired(
      courseId,
      courseVersionId,
      cohortId,
    );
  }

  async clearPolicyReacknowledgement(
    userId: string,
    courseId: string,
    courseVersionId: string,
    cohortId: string,
  ): Promise<void> {
    await this.enrollmentRepo.clearReacknowledgement(
      userId,
      courseId,
      courseVersionId,
      cohortId,
    );
  }
}
