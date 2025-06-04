import 'reflect-metadata';
import {
  JsonController,
  Authorized,
  Post,
  Body,
  Get,
  Put,
  Params,
  HttpCode,
  Delete,
} from 'routing-controllers';
import {inject, injectable} from 'inversify';
import {Course} from '../classes/transformers/Course';
import {
  CreateCourseBody,
  ReadCourseParams,
  UpdateCourseParams,
  UpdateCourseBody,
  CourseDataResponse,
  CourseNotFoundErrorResponse,
} from '../classes/validators/CourseValidators';
import {CourseService} from '../services';
import {getMetadataArgsStorage} from 'routing-controllers';
import {
  OpenAPI,
  routingControllersToSpec,
  ResponseSchema,
} from 'routing-controllers-openapi';
import {validationMetadatasToSchemas} from 'class-validator-jsonschema';
import {coursesModuleOptions} from '..';
import {BadRequestErrorResponse} from '../../../shared/middleware/errorHandler';
import TYPES from '../types';

@injectable()
@JsonController('/courses')
export class CourseController {
  constructor(
    @inject(TYPES.CourseService) private readonly courseService: CourseService,
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
  @HttpCode(204)
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
    return;
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
