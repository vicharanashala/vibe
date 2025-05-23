import {InternalServerError, NotFoundError} from 'routing-controllers';
import {ICourseRepository} from 'shared/database';
import {Inject, Service} from 'typedi';
import {CreateCourseVersionBody} from '../classes/validators';
import {CourseVersion} from '../classes/transformers';
import {ObjectId, ReadConcern, ReadPreference, WriteConcern} from 'mongodb';
import {ICourseVersion} from 'shared/interfaces/Models';
import {DeleteError} from 'shared/errors/errors';
import {instanceToPlain} from 'class-transformer';

@Service()
export class CourseVersionService {
  constructor(
    @Inject('CourseRepo')
    private readonly courseRepo: ICourseRepository,
  ) {}

  private readonly transactionOptions = {
    readPreference: ReadPreference.PRIMARY,
    readConcern: new ReadConcern('majority'),
    writeConcern: new WriteConcern('majority'),
  };

  async createCourseVersion(
    courseId: string,
    body: CreateCourseVersionBody,
  ): Promise<CourseVersion> {
    const course = await this.courseRepo.read(courseId);
    if (!course) {
      throw new NotFoundError('Course not found');
    }

    const session = (await this.courseRepo.getDBClient()).startSession();
    let newVersion: CourseVersion;

    try {
      await session.startTransaction(this.transactionOptions);
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

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }

    return newVersion;
  }

  public async readCourseVersion(
    courseVersionId: string,
  ): Promise<CourseVersion> {
    const session = (await this.courseRepo.getDBClient()).startSession();

    let version: CourseVersion;

    try {
      await session.startTransaction(this.transactionOptions);

      const readVersion = await this.courseRepo.readVersion(
        courseVersionId,
        session,
      );
      if (!readVersion) {
        throw new InternalServerError('Failed to read course version.');
      }

      version = instanceToPlain(
        Object.assign(new CourseVersion(), readVersion),
      ) as CourseVersion;

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }

    return version;
  }

  public async deleteCourseVersion(
    courseId: string,
    courseVersionId: string,
  ): Promise<CourseVersion> {
    const session = (await this.courseRepo.getDBClient()).startSession();

    let removedVersion: CourseVersion;

    try {
      await session.startTransaction(this.transactionOptions);

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
        throw new DeleteError('Failed to delete course version');
      }

      removedVersion = instanceToPlain(
        Object.assign(new CourseVersion(), removedVersion),
      ) as CourseVersion;
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }

    return removedVersion;
  }
}
