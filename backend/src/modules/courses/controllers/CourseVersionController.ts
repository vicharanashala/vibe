import {instanceToPlain} from 'class-transformer';
import {ObjectId} from 'mongodb';
import 'reflect-metadata';
import {
  Authorized,
  Body,
  Get,
  HttpError,
  JsonController,
  Params,
  Post,
  Delete,
  BadRequestError,
  HttpCode,
  NotFoundError,
} from 'routing-controllers';
import {CourseRepository} from 'shared/database/providers/mongo/repositories/CourseRepository';
import {DeleteError, ReadError} from 'shared/errors/errors';
import {Inject, Service} from 'typedi';
import {CourseVersion} from '../classes/transformers/CourseVersion';
import {
  CreateCourseVersionParams,
  CreateCourseVersionBody,
  ReadCourseVersionParams,
  DeleteCourseVersionParams,
} from '../classes/validators/CourseVersionValidators';

/**
 * Controller for handling course version operations like creation and retrieval.
 * All routes are prefixed with `/courses`.
 *
 * @category Courses/Controllers
 * @categoryDescription
 * Manages creation of new course versions and retrieval of version details.
 * Only authorized users (admin/instructor/student) may access relevant endpoints.
 */
@JsonController('/courses')
@Service()
export class CourseVersionController {
  constructor(
    @Inject('CourseRepo') private readonly courseRepo: CourseRepository,
  ) {}

  /**
   * Create a new version for a specific course.
   *
   * @param params - Parameters including the course ID (`:id`)
   * @param body - Payload containing version name and description
   * @returns The updated course and the newly created version
   *
   * @throws HttpError(404) if the course is not found
   * @throws HttpError(500) on any other internal error
   *
   * @category Courses/Controllers
   */
  @Authorized(['admin', 'instructor'])
  @Post('/:id/versions')
  @HttpCode(201)
  async create(
    @Params() params: CreateCourseVersionParams,
    @Body() body: CreateCourseVersionBody,
  ) {
    const {id} = params;
    try {
      // console.log("id", id);
      // console.log("payload", payload);
      //Fetch Course from DB
      const course = await this.courseRepo.read(id);

      //Create Version
      let version = new CourseVersion(body);
      version.courseId = new ObjectId(id);
      version = (await this.courseRepo.createVersion(version)) as CourseVersion;

      //Add Version to Course
      course.versions.push(version._id);
      course.updatedAt = new Date();

      //Update Course
      const updatedCourse = await this.courseRepo.update(id, course);

      return {
        course: instanceToPlain(updatedCourse),
        version: instanceToPlain(version),
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new HttpError(404, error.message);
      }
      if (error instanceof ReadError) {
        throw new HttpError(500, error.message);
      }
      throw new HttpError(500, error.message);
    }
  }

  /**
   * Retrieve a course version by its ID.
   *
   * @param params - Parameters including version ID (`:id`)
   * @returns The course version object if found
   *
   * @throws HttpError(404) if the version is not found
   * @throws HttpError(500) for read errors
   *
   * @category Courses/Controllers
   */
  @Authorized(['admin', 'instructor', 'student'])
  @Get('/versions/:id')
  async read(@Params() params: ReadCourseVersionParams) {
    const {id} = params;
    try {
      const version = await this.courseRepo.readVersion(id);
      return instanceToPlain(version);
    } catch (error) {
      if (error instanceof ReadError) {
        throw new HttpError(500, error.message);
      }
      if (error instanceof NotFoundError) {
        throw new HttpError(404, error.message);
      }
      throw new HttpError(500, error.message);
    }
  }
  /**
   * Delete the course version by its ID
   *
   * @params params - Parameters including the courseID and version ID.
   * @returns The deleted course version object.
   *
   * @throws HttpError(404) if the course or version is not found.
   * @throws HttpError(500) on any other internal server errors.
   *
   * @category Courses/Controllers
   */

  @Authorized(['admin', 'instructor'])
  @Delete('/:courseId/versions/:versionId')
  async delete(@Params() params: DeleteCourseVersionParams) {
    const {courseId, versionId} = params;
    if (!versionId || !courseId) {
      throw new BadRequestError('Version ID is required');
    }
    try {
      const version = await this.courseRepo.deleteVersion(courseId, versionId);
      return {
        message: `Version with the ID ${versionId} has been deleted successfully.`,
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new HttpError(404, error.message);
      }
      if (error instanceof DeleteError) {
        throw new HttpError(500, error.message);
      }
    }
  }
}
