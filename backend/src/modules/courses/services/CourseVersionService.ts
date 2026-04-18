import {CourseVersion} from '#courses/classes/transformers/CourseVersion.js';
import {CreateCourseVersionBody} from '#courses/classes/validators/CourseVersionValidators.js';
import {BaseService} from '#root/shared/classes/BaseService.js';
import {ICourseRepository} from '#root/shared/database/interfaces/ICourseRepository.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {instanceToPlain} from 'class-transformer';
import {injectable, inject} from 'inversify';
import {ObjectId} from 'mongodb';
import {NotFoundError, InternalServerError} from 'routing-controllers';
@injectable()
export class CourseVersionService extends BaseService {
  constructor(
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,

    @inject(GLOBAL_TYPES.Database)
    private readonly database: MongoDatabase,
  ) {
    super(database);
  }

  async createCourseVersion(
    courseId: string,
    body: CreateCourseVersionBody,
  ): Promise<CourseVersion> {
    return this._withTransaction(async session => {
      const course = await this.courseRepo.read(courseId);
      if (!course) {
        throw new NotFoundError('Course not found');
      }
      let newVersion: CourseVersion;
      // Step 2: Create new version
      newVersion = new CourseVersion(body);
      newVersion.courseId = new ObjectId(courseId);

      const createdVersion = await this.courseRepo.createVersion(
        newVersion,
        session,
      );
      if (!createdVersion) {
        throw new InternalServerError('Failed to create course version.');
      }

      newVersion = instanceToPlain(
        Object.assign(new CourseVersion(), createdVersion),
      ) as CourseVersion;

      // Step 3: Update course metadata
      course.versions.push(createdVersion._id);
      course.updatedAt = new Date();

      const updatedCourse = await this.courseRepo.update(
        courseId,
        course,
        session,
      );
      if (!updatedCourse) {
        throw new InternalServerError(
          'Failed to update course with new version.',
        );
      }
      return newVersion;
    });
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
}
