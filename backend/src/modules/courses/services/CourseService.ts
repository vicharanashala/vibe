import {Course} from '#courses/classes/transformers/Course.js';
import {USERS_TYPES} from '#root/modules/users/types.js';
import {BaseService} from '#root/shared/classes/BaseService.js';
import {ICourseRepository} from '#root/shared/database/interfaces/ICourseRepository.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {IItemRepository} from '#root/shared/index.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {injectable, inject} from 'inversify';
import {InternalServerError, NotFoundError} from 'routing-controllers';
@injectable()
class CourseService extends BaseService {
  constructor(
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,
    @inject(USERS_TYPES.ItemRepo)
    private readonly itemRepo: IItemRepository,

    @inject(GLOBAL_TYPES.Database)
    private readonly mongoDatabase: MongoDatabase,
  ) {
    super(mongoDatabase);
  }

  async createCourse(course: Course): Promise<Course> {
    return this._withTransaction(async session => {
      const createdCourse = await this.courseRepo.create(course, session);
      if (!createdCourse) {
        throw new InternalServerError(
          'Failed to create course. Please try again later.',
        );
      }
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
      const deleted = await this.courseRepo.delete(id, session);
      if (!deleted) {
        throw new NotFoundError(
          'No course found with the specified ID. Please verify the ID and try again.',
        );
      }
    });
  }

  async updateCourseVersionTotalItemCount(): Promise<void> {
    return this._withTransaction(async session => {
      const courses = await this.courseRepo.getAllCourses(session);

      const courseVersionIds = courses.flatMap(course => course.versions);
      console.log(courseVersionIds) 
      for (const courseVersionId of courseVersionIds) {
        try {
          const courseVersion = await this.courseRepo.readVersion(
            courseVersionId as string,
            session,
          );

          courseVersion.totalItems =
            await this.itemRepo.CalculateTotalItemsCount(
              courseVersion.courseId.toString(),
              courseVersion._id.toString(),
              session,
            );

          await this.courseRepo.updateVersion(
            courseVersion._id.toString(),
            courseVersion,
            session,
          );
          console.log(
            `Updated totalItems for course version: ${courseVersionId}`,
          );
        } catch (error) {
          console.error(
            `Failed to update course version: ${courseVersionId}`,
            error,
          );
          throw new InternalServerError('Failed to updates count');
        }
      }
    });
  }
}

export {CourseService};
