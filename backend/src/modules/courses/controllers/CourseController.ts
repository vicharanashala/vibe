import {CourseService} from '#courses/services/CourseService.js';
import {validationMetadatasToSchemas} from 'class-validator-jsonschema';
import {injectable, inject} from 'inversify';
import {
  JsonController,
  Post,
  HttpCode,
  Body,
  Get,
  Params,
  Put,
  Delete,
  OnUndefined,
  ForbiddenError,
  Authorized,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {COURSES_TYPES} from '#courses/types.js';
import {BadRequestErrorResponse} from '#shared/middleware/errorHandler.js';
import {Course} from '#courses/classes/transformers/Course.js';
import {
  CourseDataResponse,
  CourseBody,
  CourseNotFoundErrorResponse,
  CourseIdParams,
} from '#courses/classes/validators/CourseValidators.js';
import { CourseActions, getCourseAbility } from '../abilities/courseAbilities.js';
import { Ability } from '#root/shared/functions/AbilityDecorator.js';
import { subject } from '@casl/ability';

@OpenAPI({
  tags: ['Courses'],
  description: 'Operations for managing courses in the system',
})
@injectable()
@JsonController('/courses')
export class CourseController {
  constructor(
    @inject(COURSES_TYPES.CourseService)
    private readonly courseService: CourseService,
  ) {}

  @OpenAPI({
    summary: 'Create a new course',
    description: 'Creates a new course in the system.<br/>.',
  })
  @Authorized()
  @Post('/', {transformResponse: true})
  @HttpCode(201)
  @ResponseSchema(CourseDataResponse, {
    description: 'Course created successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async create(@Body() body: CourseBody, @Ability(getCourseAbility) {ability}): Promise<Course> {
    // Build subject context first
    
    if (!ability.can(CourseActions.Create, 'Course')) {
      throw new ForbiddenError('You do not have permission to create courses');
    }
    
    const course = new Course(body);
    const createdCourse = await this.courseService.createCourse(course);
    return createdCourse;
  }

  @OpenAPI({
    summary: 'Get course details',
    description: `Retrieves course information by ID.<br/>
Accessible to:
- Users who are part of the course (students, teaching assistants, instructors, or managers)
`,
  })
  @Authorized()
  @Get('/:courseId', {transformResponse: true})
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
  async read(@Params() params: CourseIdParams, @Ability(getCourseAbility) {ability}) {
    const {courseId} = params;
    
    // Create a course resource object with the courseId for permission checking
    const courseResource = subject('Course', { courseId });
    
    // Check permission using ability.can() with the actual course resource
    if (!ability.can(CourseActions.View, courseResource)) {
      throw new ForbiddenError('You do not have permission to view this course');
    }
    
    const course = await this.courseService.readCourse(courseId);
    return course;
  }

  @OpenAPI({
    summary: 'Update a course',
    description: `Updates course metadata such as title or description.<br/>
Accessible to:
- Instructor or manager for the course.`,
  })
  @Authorized()
  @Put('/:courseId', {transformResponse: true})
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
  async update(@Params() params: CourseIdParams, @Body() body: CourseBody, @Ability(getCourseAbility) {ability}) {
    const {courseId} = params;
    
    // Create a course resource object with the courseId for permission checking
    const courseResource = subject('Course', { courseId });
    
    // Check permission using ability.can() with the actual course resource
    if (!ability.can(CourseActions.Modify, courseResource)) {
      throw new ForbiddenError('You do not have permission to update this course');
    }
    
    const updatedCourse = await this.courseService.updateCourse(courseId, body);
    return updatedCourse;
  }

  @OpenAPI({
    summary: 'Delete a course',
    description: 'Deletes a course by ID.',
  })
  @Authorized()
  @Delete('/:courseId', {transformResponse: true})
  @OnUndefined(204)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(CourseNotFoundErrorResponse, {
    description: 'Course not found',
    statusCode: 404,
  })
  async delete(@Params() params: CourseIdParams, @Ability(getCourseAbility) {ability}) {
    const {courseId} = params;
    
    // Create a course resource object with the courseId for permission checking
    const courseResource = subject('Course', { courseId });
    
    // Check permission using ability.can() with the actual course resource
    if (!ability.can(CourseActions.Delete, courseResource)) {
      throw new ForbiddenError('You do not have permission to delete this course');
    }
    
    await this.courseService.deleteCourse(courseId);
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
