
import { USERS_TYPES } from '#root/modules/users/types.js';
import { BaseService } from '#root/shared/classes/BaseService.js';
import { MongoDatabase } from '#root/shared/database/providers/mongo/MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { injectable, inject } from 'inversify';
import { ObjectId } from 'mongodb';
import { InternalServerError, NotFoundError } from 'routing-controllers';
import { Course } from '../classes/transformers/course.js';
import { CreateCourseVersionBody } from '../classes/validators/courseVersionValidator.js';
import { CourseVersionService } from './courseVersionService.js';
import { ICourseRepository } from '#root/shared/index.js';
import { EnrollmentService } from '#root/modules/users/services/EnrollmentService.js';
@injectable()
export class CourseService extends BaseService {
  constructor(
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository  ,

    @inject(GLOBAL_TYPES.CourseVersionService)
    private readonly courseVersionService: CourseVersionService,

    @inject(USERS_TYPES.EnrollmentService)
    private readonly enrollmentService: EnrollmentService,

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
  ): Promise<Course> {
    return this._withTransaction(async session => {
      const createdCourse = await this.courseRepo.create(course, session);
      if (!createdCourse) {
        throw new InternalServerError('Failed to create course. Please try again later.');
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

      const enrollPromise = this.enrollmentService.enrollUser(
        userId,
        courseId,
        versionId,
        'INSTRUCTOR',
        false,
        session,
      );
      await Promise.all([enrollPromise]);
      return createdCourse;
    });
  }
}