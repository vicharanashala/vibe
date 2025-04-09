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
 * @category Courses/Controllers
 * @categoryDescription

 */

/**
 * Controller for managing courses.
 * Handles API endpoints related to course creation, reading, and updating.
 * Uses dependency injection to work with CourseRepository and exposes
 * endpoints under the `/courses` route.
 *
 * @category Courses/Controllers
 */
@JsonController('/courses')
@Service()
export class CourseController {
  constructor(
    @Inject('NewCourseRepo') private readonly courseRepo: CourseRepository,
  ) {}

  /**
   * Create a new course.
   * @param body - Validated payload for course creation.
   * @returns The created course object.
   *
   * @throws HttpError - If the course creation fails.
   */
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

  /**
   * Retrieve a course by its ID.
   * @param params - Contains the course Mongo ID.
   * @returns The course data if found.
   *
   * @throws HttpError - If the course is not found or if an error occurs.
   */
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

  /**
   * Update a course by ID.
   * @param params - The course ID.
   * @param body - The fields to update.
   * @returns The updated course object.
   *
   * @throws HttpError - If the course is not found or if an error occurs.
   */
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
