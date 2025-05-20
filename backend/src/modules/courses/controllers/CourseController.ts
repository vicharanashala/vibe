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
} from 'routing-controllers';
import {Service, Inject} from 'typedi';
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
import {BadRequestErrorResponse} from 'shared/middleware/errorHandler';

@OpenAPI({
  tags: ['Courses'],
})
@JsonController('/courses')
@Service()
export class CourseController {
  constructor(
    @Inject('CourseService') private readonly courseService: CourseService,
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
  @OpenAPI({
    summary: 'Create Course',
    description: 'Creates a new course with the provided details.',
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
  @OpenAPI({
    summary: 'Get Course',
    description: 'Retrieves the course details for the specified course ID.',
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
  @OpenAPI({
    summary: 'Update Course',
    description: 'Updates the course details for the specified course ID.',
  })
  async update(
    @Params() params: UpdateCourseParams,
    @Body() body: UpdateCourseBody,
  ) {
    const {id} = params;
    const updatedCourse = await this.courseService.updateCourse(id, body);
    return updatedCourse;
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
