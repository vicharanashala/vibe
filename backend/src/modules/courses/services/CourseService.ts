import {ICourseRepository} from '../../../shared/database';
import {inject, injectable} from 'inversify';
import {Course} from '../classes/transformers';
import {InternalServerError, NotFoundError} from 'routing-controllers';
import {ReadConcern, ReadPreference, WriteConcern} from 'mongodb';
import {BaseService} from 'shared/classes/BaseService';
import {MongoDatabase} from 'shared/database/providers/MongoDatabaseProvider';
import TYPES from '../types';
import GLOBAL_TYPES from '../../../types';

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
