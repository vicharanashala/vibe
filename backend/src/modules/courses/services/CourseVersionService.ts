import {CourseVersion} from '#courses/classes/transformers/CourseVersion.js';
import {
  CreateCourseVersionBody,
  UpdateCourseVersionBody,
} from '#courses/classes/validators/CourseVersionValidators.js';
import {BaseService} from '#root/shared/classes/BaseService.js';
import {ICourseRepository} from '#root/shared/database/interfaces/ICourseRepository.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {instanceToPlain} from 'class-transformer';
import {injectable, inject} from 'inversify';
import {ClientSession, ObjectId} from 'mongodb';
import {
  NotFoundError,
  InternalServerError,
  BadRequestError,
} from 'routing-controllers';
import {Course} from '../classes/index.js';
import {ICourse, ICourseVersion} from '#root/shared/index.js';
import {USERS_TYPES} from '#root/modules/users/types.js';
import {EnrollmentService} from '#root/modules/users/services/EnrollmentService.js';
@injectable()
export class CourseVersionService extends BaseService {
  constructor(
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,
    @inject(USERS_TYPES.EnrollmentService)
    private readonly enrollmentService: EnrollmentService,

    @inject(GLOBAL_TYPES.Database)
    private readonly database: MongoDatabase,
  ) {
    super(database);
  }

  async createCourseVersion(
    courseId: string,
    body: CreateCourseVersionBody,
    session?: ClientSession,
  ): Promise<CourseVersion> {
    const run = async (txnSession: ClientSession) => {
      if (!courseId) {
        throw new NotFoundError('Course id not found');
      }

      const course = await this.courseRepo.read(courseId, txnSession);
      if (!course) {
        throw new NotFoundError('Course not found');
      }

      let newVersion = new CourseVersion(body);
      newVersion.courseId = new ObjectId(courseId);

      const createdVersion = await this.courseRepo.createVersion(
        newVersion,
        txnSession,
      );
      if (!createdVersion) {
        throw new InternalServerError('Failed to create course version.');
      }

      newVersion = instanceToPlain(
        Object.assign(new CourseVersion(), createdVersion),
      ) as CourseVersion;

      // Update course metadata
      course.versions.push(new ObjectId(createdVersion._id));
      course.updatedAt = new Date();

      const updatedCourse = await this.courseRepo.update(
        courseId,
        course,
        txnSession,
      );
      if (!updatedCourse) {
        throw new InternalServerError(
          'Failed to update course with new version.',
        );
      }

      return newVersion;
    };

    // If session provided, use it; otherwise wrap in a new transaction
    return session ? run(session) : this._withTransaction(run);
  }

  public async readCourseVersion(
    courseVersionId: string,
  ): Promise<CourseVersion> {
    return this._withTransaction(async session => {
      const readVersion = await this.courseRepo.readVersion(
        courseVersionId,
        session,
      );
      if (!readVersion) {
        throw new InternalServerError('Failed to read course version.');
      }

      const version = instanceToPlain(
        Object.assign(new CourseVersion(), readVersion),
      ) as CourseVersion;

      return version;
    });
  }

  public async updateCourseVersion(
    courseVersionId: string,
    body: UpdateCourseVersionBody,
  ): Promise<CourseVersion> {
    return this._withTransaction(async session => {
      const existingVersion = await this.courseRepo.readVersion(
        courseVersionId,
        session,
      );
      if (!existingVersion) {
        throw new NotFoundError('Course version not found');
      }

      if (body.version) existingVersion.version = body.version;
      if (body.description) existingVersion.description = body.description;
      existingVersion.updatedAt = new Date();

      const updatedVersion = await this.courseRepo.updateVersion(
        courseVersionId,
        existingVersion,
        session,
      );

      if (!updatedVersion) {
        throw new InternalServerError('Failed to update course version');
      }

      const version = instanceToPlain(
        Object.assign(new CourseVersion(), updatedVersion),
      ) as CourseVersion;

      return version;
    });
  }

  public async deleteCourseVersion(
    courseId: string,
    courseVersionId: string,
  ): Promise<Boolean> {
    return this._withTransaction(async session => {
      const readCourseVersion = await this.courseRepo.readVersion(
        courseVersionId,
        session,
      );
      if (!readCourseVersion) {
        throw new InternalServerError(
          'Failed to update course with new version.',
        );
      }

      const course = await this.courseRepo.read(courseId);
      if (!course) {
        throw new NotFoundError(`Course with ID ${courseId} not found.`);
      }

      const itemGroupsIds = readCourseVersion.modules.flatMap(module =>
        module.sections.map(section => new ObjectId(section.itemsGroupId)),
      );

      const versionDeleteResult = await this.courseRepo.deleteVersion(
        courseId,
        courseVersionId,
        itemGroupsIds,
        session,
      );
      if (versionDeleteResult.deletedCount !== 1) {
        throw new InternalServerError('Failed to delete course version');
      }
      return true;
    });
  }

  async copyCourseVersion(
    courseId: string,
    courseVersionId: string,
  ): Promise<boolean> {
    return this._withTransaction(async session => {
      try {
        if (!courseId || !courseVersionId) {
          throw new BadRequestError(
            `Invalid courseId (${courseId}) or courseVersionId (${courseVersionId})`,
          );
        }

        // 1. Fetch the existing version
        const existingVersion = await this.courseRepo.readVersion(
          courseVersionId,
          session,
        );
        if (!existingVersion) {
          throw new NotFoundError(
            `Course version ${courseVersionId} not found`,
          );
        }

        const existingCourse = await this.courseRepo.read(courseId, session);
        if (!existingCourse) {
          throw new NotFoundError(`Course ${courseId} not found`);
        }

        // 2. Create new course version
        const convertedModules = existingVersion.modules.map(module => ({
          ...module,
          sections: module.sections.map(section => ({
            ...section,
            itemsGroupId: new ObjectId(section.itemsGroupId),
          })),
        }));

        const newVersionData: ICourseVersion = {
          _id: undefined,
          courseId: new ObjectId(courseId),
          version: existingVersion.version,
          description: existingVersion.description,
          totalItems: existingVersion.totalItems,
          modules: convertedModules,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const newVersion = await this.courseRepo.createVersion(
          newVersionData,
          session,
        );
        if (!newVersion)
          throw new InternalServerError(
            'Failed to create new course version, try again!',
          );
        // 3. Create new course
        const newCourseData: ICourse = {
          _id: undefined,
          name: existingCourse.name + '(copy)',
          description: existingCourse.description,
          versions: [new ObjectId(newVersion._id)],
          instructors: existingCourse.instructors.map(id => new ObjectId(id)),
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const newCourse = await this.courseRepo.create(newCourseData, session);
        if (!newCourse)
          throw new InternalServerError(
            'Failed to create new course, try again!',
          );
          
        // 4. Copy enrollments
        const existingEnrollments =
          await this.enrollmentService.getNonStudentEnrollmentsByCourseVersion(
            courseId,
            courseVersionId,
          );

        if (existingEnrollments && existingEnrollments.length) {
          const existingEnrolledUsersWithRoles = existingEnrollments.map(
            enr => ({
              userId: enr.userId.toString(),
              role: enr.role,
            }),
          );

          const newVersionIdStr = newVersion._id.toString();
          const newCourseIdStr = newCourse._id.toString();

          await this.enrollmentService.bulkEnrollUsers(
            existingEnrolledUsersWithRoles,
            newCourseIdStr,
            newVersionIdStr,
            session,
          );
        }

        return true;
      } catch (error) {
        console.error('Failed to copy course version:', error);
        return false;
      }
    });
  }
}
