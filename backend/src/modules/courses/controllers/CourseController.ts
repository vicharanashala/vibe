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
  HttpCode,
  NotFoundError,
} from 'routing-controllers';
import {CourseRepository} from 'shared/database/providers/mongo/repositories/CourseRepository';
import {Service, Inject} from 'typedi';
import {Course} from '../classes/transformers/Course';
import {
  CreateCourseBody,
  ReadCourseParams,
  UpdateCourseParams,
  UpdateCourseBody,
} from '../classes/validators/CourseValidators';
import {CourseService} from '../services';

@JsonController('/courses')
@Service()
export class CourseController {
  constructor(
    @Inject('CourseService') private readonly courseService: CourseService,
  ) {}

  @Authorized(['admin', 'instructor'])
  @Post('/', {transformResponse: true})
  @HttpCode(201)
  async create(@Body() body: CreateCourseBody): Promise<Course> {
    const course = new Course(body);
    const createdCourse = await this.courseService.createCourse(course);
    return createdCourse;
  }

  @Authorized(['admin', 'instructor'])
  @Get('/:id', {transformResponse: true})
  async read(@Params() params: ReadCourseParams) {
    const {id} = params;
    const course = await this.courseService.readCourse(id);
    return course;
  }

  @Authorized(['admin', 'instructor'])
  @Put('/:id', {transformResponse: true})
  async update(
    @Params() params: UpdateCourseParams,
    @Body() body: UpdateCourseBody,
  ) {
    const {id} = params;
    const updatedCourse = await this.courseService.updateCourse(id, body);
    return updatedCourse;
  }
}
