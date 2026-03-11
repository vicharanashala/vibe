import {Course} from '#courses/classes/transformers/Course.js';
import {USERS_TYPES} from '#root/modules/users/types.js';
import {BaseService} from '#root/shared/classes/BaseService.js';
import {ICourseRepository} from '#root/shared/database/interfaces/ICourseRepository.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {
  IItemRepository,
  ProctoringComponent,
  ProgressRepository,
  SettingRepository,
} from '#root/shared/index.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {injectable, inject} from 'inversify';
import {ObjectId} from 'mongodb';
import {InternalServerError, NotFoundError} from 'routing-controllers';
import {CourseVersionService} from './CourseVersionService.js';
import {ActiveUserDto, CreateCourseVersionBody} from '../classes/index.js';
import {EnrollmentService} from '#root/modules/users/services/EnrollmentService.js';
import {InviteService} from '#root/modules/notifications/index.js';
import {NOTIFICATIONS_TYPES} from '#root/modules/notifications/types.js';
import {SETTING_TYPES} from '#root/modules/setting/types.js';
import {
  CourseSetting,
  CourseSettingService,
  CreateCourseSettingBody,
} from '#root/modules/setting/index.js';
@injectable()
class CourseService extends BaseService {
  constructor(
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,
    @inject(USERS_TYPES.ItemRepo)
    private readonly itemRepo: IItemRepository,

    @inject(SETTING_TYPES.SettingRepo)
    private readonly settingsRepo: SettingRepository,

    @inject(GLOBAL_TYPES.CourseVersionService)
    private readonly courseVersionService: CourseVersionService,

    @inject(USERS_TYPES.EnrollmentService)
    private readonly enrollmentService: EnrollmentService,

    @inject(USERS_TYPES.ProgressRepo)
    private progressRepo: ProgressRepository,

    @inject(NOTIFICATIONS_TYPES.InviteService)
    private readonly inviteService: InviteService,

    @inject(GLOBAL_TYPES.Database)
    private readonly mongoDatabase: MongoDatabase,
  ) {
    super(mongoDatabase);
  }

  async createCourse(
    course: Course,
    versionName: string,
    versionDescription: string,
    userId: string,
    cohorts: string[]
  ): Promise<Course> {
    return this._withTransaction(async session => {
      const createdCourse = await this.courseRepo.create(course, session);
      if (!createdCourse) {
        throw new InternalServerError(
          'Failed to create course. Please try again later.',
        );
      }

      const courseId = createdCourse._id.toString();

      // Create course version (depends on course)
      const versionPayload: CreateCourseVersionBody = {
        version: versionName,
        description: versionDescription,
      };

      const newVersion = await this.courseVersionService.createCourseVersion(
        courseId,
        versionPayload,
        session,
      );

      const versionId = newVersion._id.toString();

      const cohortIds = await this.courseRepo.createCohorts(
        versionId,
        cohorts,
        session
      );

      await this.courseRepo.addCohortsToVersion(
        versionId,
        cohortIds,
        session
      );

      createdCourse.versions.push(new ObjectId(versionId));

      // Prepare independent tasks
      const enrollPromise = this.enrollmentService.enrollUser(
        userId,
        courseId,
        versionId,
        'INSTRUCTOR',
        false,
        undefined,
        session,
      );

      // const defaultSettingsPayload: CreateCourseSettingBody = {
      //   courseId,
      //   courseVersionId: versionId,
      //   settings: {
      //     proctors: {
      //       detectors: Object.values(ProctoringComponent).map(detector => ({
      //         detectorName: detector,
      //         settings: { enabled: false, options: {} },
      //       })),
      //     },
      //     linearProgressionEnabled: false,
      //     seekForwardEnabled: false,
      //   },
      // };
      // const courseSettings = new CourseSetting(defaultSettingsPayload);
      // const settingsPromise = this.settingsRepo.createCourseSettings(courseSettings, session);

      await enrollPromise;

      return createdCourse;
    });
  }

  async readCourse(id: string): Promise<Course> {
    return this._withTransaction(async session => {
      const course = await this.courseRepo.read(id);
      if (!course) {
        throw new NotFoundError(
          'No course found with the specified ID. Please verify the ID and try again.',
        );
      }
      return course;
    });
  }

  async updateCourse(
    id: string,
    data: Pick<Course, 'name' | 'description'>,
  ): Promise<Course> {
    return this._withTransaction(async session => {
      const updatedCourse = await this.courseRepo.update(id, data, session);
      if (!updatedCourse) {
        throw new NotFoundError(
          'No course found with the specified ID. Please verify the ID and try again.',
        );
      }
      return updatedCourse;
    });
  }

  async deleteCourse(id: string): Promise<void> {
    return this._withTransaction(async session => {
      // Cancel all pending invites before soft-deleting
      await this.inviteService.cancelPendingInvites({courseId: id}, session);

      const deleted = await this.courseRepo.delete(id, session);
      if (!deleted) {
        throw new NotFoundError(
          'No course found with the specified ID. Please verify the ID and try again.',
        );
      }
    });
  }

  async updateCourseVersionTotalItemCount(
    courseId?: string,
    courseVersionId?: string,
  ): Promise<{
    totalVersions: number;
    updatedVersions: number;
    failedVersions: number;
  }> {
    let versionIds: string[] = [];

    // 1️⃣ If courseVersionId is provided
    if (courseVersionId) {
      if (courseId) {
        const course = await this.courseRepo.read(courseId);
        if (!course) {
          throw new Error(`Course with id ${courseId} not found`);
        }

        const belongsToCourse = course.versions.some(
          v => v.toString() === courseVersionId,
        );

        if (!belongsToCourse) {
          throw new Error(
            `Version ${courseVersionId} does not belong to course ${courseId}`,
          );
        }
      }

      versionIds = [courseVersionId];
    }

    // 2️⃣ If only courseId is provided
    else if (courseId) {
      const course = await this.courseRepo.read(courseId);
      if (!course) {
        throw new Error(`Course with id ${courseId} not found`);
      }

      versionIds = course.versions.map(v => v.toString());
    }

    // 3️⃣ Otherwise process all versions
    else {
      const courses = await this.courseRepo.getAllCourses();
      versionIds = courses.flatMap(c => c.versions.map(v => v.toString()));
    }

    const bulkOps = [];
    let updatedVersions = 0;
    let failedVersions = 0;

    for (const versionId of versionIds) {
      try {
        const {totalItems, itemCounts} =
          await this.itemRepo.calculateItemCountsForVersion(versionId);

        bulkOps.push({
          updateOne: {
            filter: {_id: new ObjectId(versionId)},
            update: {
              $set: {
                totalItems,
                itemCounts,
              },
            },
          },
        });

        updatedVersions++;
      } catch (err) {
        failedVersions++;
        console.error(`Failed for version ${versionId}`, err);
      }
    }

    if (bulkOps.length) {
      await this.courseRepo.bulkUpdateVersions(bulkOps);
    }

    return {
      totalVersions: versionIds.length,
      updatedVersions,
      failedVersions,
    };
  }

  async getActiveUsersByCourse(
    courseId?: string,
    courseVersionId?: string,
    startTimeStamp?: string,
    endTimeStamp?: string,
  ): Promise<{activeUsers: ActiveUserDto[]}> {
    return this._withTransaction(async session => {
      const activeUsers = await this.progressRepo.getActiveUsers(
        courseId,
        courseVersionId,
        startTimeStamp,
        endTimeStamp,
      );
      return activeUsers;
    });
  }

  async getPublicCourses(
    userId: string,
    page: number,
    limit: number,
    search: string,
  ): Promise<{
    courses: any[];
    currentPage: number;
    totalPages: number;
    totalDocuments: number;
  }> {
    // return this._withTransaction(async session => {
      // Get enrolled course IDs by userId through enrollmentService
      const userEnrollments =
        await this.enrollmentService.getAllEnrollments(userId);
      const enrolledCourseIds = userEnrollments.map(enrollment =>
        enrollment.courseId.toString(),
      );
           const enrolledVersionIds = userEnrollments.map(enrollment => enrollment.courseVersionId.toString());
      const enrolledCohortIds = userEnrollments.map(enrollment => enrollment?.cohortId?.toString());

      // Query public courses
      const skip = (page - 1) * limit;

      // const publicCourses = await this.settingsRepo.getPublicCourses(
      //   enrolledCourseVersionIds,
      //   skip,
      //   limit,
      //   search,
      //   session
      // );

      // const totalDocuments = await this.settingsRepo.countPublicCourses(
      //   enrolledCourseVersionIds,
      //   search,
      //   session
      // );

      // const totalPages = Math.ceil(totalDocuments / limit);

      // return {
      //   courses: publicCourses,
      //   currentPage: page,
      //   totalPages,
      //   totalDocuments,
      // };

      // const publicCohorts = await this.courseVersionService.getPublicCohorts();
      const publicCohorts = await this.settingsRepo.getPublicCatalog(enrolledVersionIds, enrolledCohortIds, skip, limit, search);
      const totalDocuments = publicCohorts.length;
      const totalPages = Math.ceil(totalDocuments / limit);

      return {
        courses: publicCohorts,
        currentPage: page,
        totalPages,
        totalDocuments,
      };

    // });
  }
}

export {CourseService};
