import {instanceToPlain} from 'class-transformer';
import {ObjectId} from 'mongodb';
import 'reflect-metadata';
import {
  Authorized,
  Body,
  Get,
  HttpError,
  JsonController,
  Param,
  Post,
} from 'routing-controllers';
import {CourseRepository} from 'shared/database/providers/mongo/repositories/CourseRepository';
import {ItemNotFoundError, ReadError} from 'shared/errors/errors';
import {Inject, Service} from 'typedi';
import {CourseVersion} from '../classes/transformers/CourseVersion';
import {CreateCourseVersionPayloadValidator} from '../classes/validators/CourseVersionValidators';

/**
 *
 * @category Courses/Controllers
 */
@JsonController('/courses')
@Service()
export class CourseVersionController {
  constructor(
    @Inject('NewCourseRepo') private readonly courseRepo: CourseRepository,
  ) {}
  @Authorized(['admin', 'instructor'])
  @Post('/:id/versions')
  async create(
    @Param('id') id: string,
    @Body({validate: true}) payload: CreateCourseVersionPayloadValidator,
  ) {
    try {
      // console.log("id", id);
      // console.log("payload", payload);
      //Fetch Course from DB
      const course = await this.courseRepo.read(id);

      //Create Version
      let version = new CourseVersion(payload);
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
      //   if (error instanceof CreateError) {
      //     throw new HttpError(500, error.message);
      //   }
      //   if (error instanceof ReadError) {
      //     throw new HttpError(404, error.message);
      //   }
      //   if (error instanceof UpdateError) {
      //     throw new HttpError(500, error.message);
      //   }
      //   throw new HttpError(500, error.message);
    }
  }

  @Authorized(['admin', 'instructor', 'student'])
  @Get('/versions/:id')
  async read(@Param('id') id: string) {
    try {
      const version = await this.courseRepo.readVersion(id);
      return instanceToPlain(version);
    } catch (error) {
      if (error instanceof ReadError) {
        throw new HttpError(500, error.message);
      }
      if (error instanceof ItemNotFoundError) {
        throw new HttpError(404, error.message);
      }
    }
  }
}
