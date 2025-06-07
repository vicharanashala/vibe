import {
  CourseDataResponse,
  CreateCourseBody,
  Course,
  CourseNotFoundErrorResponse,
  ReadCourseParams,
  UpdateCourseParams,
  UpdateCourseBody,
} from '#courses/classes/index.js';
import {CourseService} from '#courses/services/CourseService.js';
import {validationMetadatasToSchemas} from 'class-validator-jsonschema';
import {injectable, inject} from 'inversify';
import {
  JsonController,
  Authorized,
  Post,
  HttpCode,
  Body,
  Get,
  Params,
  Put,
  Delete,
  OnUndefined,
} from 'routing-controllers';
import {ResponseSchema} from 'routing-controllers-openapi';
import {COURSES_TYPES} from '#courses/types.js';
import {BadRequestErrorResponse} from '#shared/middleware/errorHandler.js';
@injectable()
@JsonController('/courses')
export class CourseController {
  constructor(
    @inject(COURSES_TYPES.CourseService)
    private readonly courseService: CourseService,
  ) {}

  @Authorized(['admin', 'instructor'])
  @Post('/', {transformResponse: true})
  @HttpCode(201)
  @ResponseSchema(CourseDataResponse, {
    description: 'Course created successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async create(@Body() body: CreateCourseBody): Promise<Course> {
    const course = new Course(body);
    const createdCourse = await this.courseService.createCourse(course);
    return createdCourse;
  }

  @Authorized(['admin', 'instructor'])
  @Get('/:id', {transformResponse: true})
  @ResponseSchema(CourseDataResponse, {
    description: 'Course retrieved successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(CourseNotFoundErrorResponse, {
    description: 'Course not found',
    statusCode: 404,
  })
  async read(@Params() params: ReadCourseParams) {
    const {id} = params;
    const course = await this.courseService.readCourse(id);
    return course;
  }

  @Authorized(['admin', 'instructor'])
  @Put('/:id', {transformResponse: true})
  @ResponseSchema(CourseDataResponse, {
    description: 'Course updated successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(CourseNotFoundErrorResponse, {
    description: 'Course not found',
    statusCode: 404,
  })
  async update(
    @Params() params: UpdateCourseParams,
    @Body() body: UpdateCourseBody,
  ) {
    const {id} = params;
    const updatedCourse = await this.courseService.updateCourse(id, body);
    return updatedCourse;
  }

  @Authorized(['admin', 'instructor'])
  @Delete('/:id', {transformResponse: true})
  @OnUndefined(204)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(CourseNotFoundErrorResponse, {
    description: 'Course not found',
    statusCode: 404,
  })
  async delete(@Params() params: ReadCourseParams) {
    const {id} = params;
    await this.courseService.deleteCourse(id);
  }
}

const schemas = validationMetadatasToSchemas({
  refPointerPrefix: '#/components/schemas/',
  validationError: {
    target: true,
    value: true,
  },
});

// Export the schemas for use in DocsController
export const courseSchemas = schemas;
