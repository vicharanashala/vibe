import {ICourseRepository} from 'shared/database';
import {Inject, Service} from 'typedi';
import {Course} from '../classes/transformers';
import {InternalServerError, NotFoundError} from 'routing-controllers';

@Service()
class CourseService {
  constructor(
    @Inject('CourseRepo')
    private readonly courseRepo: ICourseRepository,
  ) {}

  async createCourse(course: Course): Promise<Course> {
    const createdCourse = await this.courseRepo.create(course);
    if (!createdCourse) {
      throw new InternalServerError(
        'Failed to create course. Please try again later.',
      );
    }
    return createdCourse;
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
