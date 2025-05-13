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
      throw new InternalServerError('Failed to create course');
    }
    return createdCourse;
  }

  async readCourse(id: string): Promise<Course> {
    const course = await this.courseRepo.read(id);
    if (!course) {
      throw new NotFoundError('Course not found');
    }
    return course;
  }

  async updateCourse(
    id: string,
    data: Pick<Course, 'name' | 'description'>,
  ): Promise<Course> {
    const updatedCourse = await this.courseRepo.update(id, data);
    if (!updatedCourse) {
      throw new NotFoundError('Course not found');
    }
    return updatedCourse;
  }
}

export {CourseService};
