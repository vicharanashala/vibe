import {ICourseRepository} from '#root/shared/database/index.js';
import {inject, injectable} from 'inversify';
import {Course} from '../classes/transformers/index.js';
import {InternalServerError, NotFoundError} from 'routing-controllers';
import {ReadConcern, ReadPreference, WriteConcern} from 'mongodb';
import {BaseService} from '#root/shared/classes/BaseService.js';
import {MongoDatabase} from '#root/shared/database/providers/index.js';
import TYPES from '../types.js';
import GLOBAL_TYPES from '../../../types.js';

@injectable()
class CourseService extends BaseService {
  constructor(
    @inject(TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,

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
}

export {CourseService};
