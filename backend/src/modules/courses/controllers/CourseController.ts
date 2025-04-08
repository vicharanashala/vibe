import {instanceToPlain} from 'class-transformer';
import 'reflect-metadata';
import {
  JsonController,
  Authorized,
  Post,
  Body,
  HttpError,
  Get,
  Put,
  Params,
} from 'routing-controllers';
import {CourseRepository} from 'shared/database/providers/mongo/repositories/CourseRepository';
import {Service, Inject} from 'typedi';
import {Course} from '../classes/transformers/Course';
import {ItemNotFoundError} from 'shared/errors/errors';
import {
  CreateCourseBody,
  ReadCourseParams,
  UpdateCourseParams,
  UpdateCourseBody,
} from '../classes/validators/CourseValidators';

/**
 *
 * @category Courses/Controllers
 */
@JsonController('/courses')
@Service()
export class CourseController {
  constructor(
    @Inject('NewCourseRepo') private readonly courseRepo: CourseRepository,
  ) {}

  @Authorized(['admin', 'instructor'])
  @Post('/')
  async create(@Body() body: CreateCourseBody) {
    let course = new Course(body);
    try {
      course = await this.courseRepo.create(course);
      return instanceToPlain(course);
    } catch (error) {
      throw new HttpError(500, error.message);
    }
  }

  @Authorized(['admin', 'instructor'])
  @Get('/:id')
  async read(@Params() params: ReadCourseParams) {
    const {id} = params;
    try {
      const courses = await this.courseRepo.read(id);
      return instanceToPlain(courses);
    } catch (error) {
      if (error instanceof ItemNotFoundError) {
        throw new HttpError(404, error.message);
      }
      throw new HttpError(500, error.message);
    }
  }

  @Authorized(['admin', 'instructor'])
  @Put('/:id')
  async update(
    @Params() params: UpdateCourseParams,
    @Body() body: UpdateCourseBody,
  ) {
    const {id} = params;
    try {
      const course = await this.courseRepo.update(id, body);
      return instanceToPlain(course);
    } catch (error) {
      if (error instanceof ItemNotFoundError) {
        throw new HttpError(404, error.message);
      }
      throw new HttpError(500, error.message);
    }
  }
}
