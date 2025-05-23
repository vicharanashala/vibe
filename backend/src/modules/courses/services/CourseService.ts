import {ICourseRepository} from 'shared/database';
import {Inject, Service} from 'typedi';
import {Course} from '../classes/transformers';
import {InternalServerError, NotFoundError} from 'routing-controllers';
import {ReadConcern, ReadPreference, WriteConcern} from 'mongodb';

@Service()
class CourseService {
  constructor(
    @Inject('CourseRepo')
    private readonly courseRepo: ICourseRepository,
  ) {}

  private readonly transactionOptions = {
    readPreference: ReadPreference.primary,
    writeConcern: new WriteConcern('majority'),
    readConcern: new ReadConcern('majority'),
  };

  async createCourse(course: Course): Promise<Course> {
    const session = (await this.courseRepo.getDBClient()).startSession();

    try {
      await session.startTransaction(this.transactionOptions);
      const createdCourse = await this.courseRepo.create(course, session);
      if (!createdCourse) {
        throw new InternalServerError(
          'Failed to create course. Please try again later.',
        );
      }
      await session.commitTransaction();
      return createdCourse;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async readCourse(id: string): Promise<Course> {
    const course = await this.courseRepo.read(id);
    if (!course) {
      throw new NotFoundError(
        'No course found with the specified ID. Please verify the ID and try again.',
      );
    }
    return course;
  }

  async updateCourse(
    id: string,
    data: Pick<Course, 'name' | 'description'>,
  ): Promise<Course> {
    const updatedCourse = await this.courseRepo.update(id, data);
    if (!updatedCourse) {
      throw new NotFoundError(
        'No course found with the specified ID. Please verify the ID and try again.',
      );
    }
    return updatedCourse;
  }
}

export {CourseService};
