import { CourseService } from '#courses/services/CourseService.js';
import { validationMetadatasToSchemas } from 'class-validator-jsonschema';
import { injectable, inject } from 'inversify';
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
  Patch,
  BadRequestError, QueryParams,
  UseBefore,
  UseAfter,
  UseInterceptor,
  Req
} from 'routing-controllers';
import { OpenAPI, ResponseSchema, } from 'routing-controllers-openapi';
import { COURSES_TYPES } from '#courses/types.js';
import { BadRequestErrorResponse } from '#shared/middleware/errorHandler.js';
import { Course } from '#courses/classes/transformers/Course.js';
import {
  CourseDataResponse,
  CourseBody,
  CourseNotFoundErrorResponse,
  CourseIdParams,
  CourseVersionQuery,
  EditCourseBody,
  CourseVersionQueryWithTime,
  ActiveUsersResponseDto,
} from '#courses/classes/validators/CourseValidators.js';
import { CourseActions, getCourseAbility } from '../abilities/courseAbilities.js';
import { Ability } from '#root/shared/functions/AbilityDecorator.js';
import { subject } from '@casl/ability';
import { USERS_TYPES } from '#root/modules/users/types.js';
import { EnrollmentService } from '#root/modules/users/services/EnrollmentService.js';
import { AuditTrailsHandler } from '#root/shared/index.js';
import { setAuditTrail } from '#root/utils/setAuditTrail.js';
import { AuditAction, AuditCategory, OutComeStatus } from '#root/modules/auditTrails/interfaces/IAuditTrails.js';
import { ObjectId } from 'mongodb';

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
    @inject(USERS_TYPES.EnrollmentService)
    private readonly enrollmentService: EnrollmentService,
  ) { }




  @OpenAPI({
    summary: 'Get Active Users by Course',
    description:
      'Fetches the list of active users enrolled in a specific course by course ID.',
  })
  // @Authorized()
  @Get('/active-users', { transformResponse: true })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(CourseNotFoundErrorResponse, {
    description: 'Course not found',
    statusCode: 404,
  })
  async getActiveUsersByCourse(
    @QueryParams() query: CourseVersionQueryWithTime,
  ) {
    const { courseId, courseVersionId, startTimeStamp, endTimeStamp } = query;

    const activeUsers = await this.courseService.getActiveUsersByCourse(courseId, courseVersionId, startTimeStamp, endTimeStamp);

    return activeUsers;
  }








  @OpenAPI({
    summary: 'Create a new course',
    description: 'Creates a new course in the system.<br/>.',
  })
  @Authorized()
  @Post('/', { transformResponse: true })
  @UseInterceptor(AuditTrailsHandler)
  @HttpCode(201)
  @ResponseSchema(CourseDataResponse, {
    description: 'Course created successfully',
    statusCode: 201,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async create(
    @Body() body: CourseBody,
    @Ability(getCourseAbility) { ability, user },
    @Req() req: Request
  ): Promise<Course> {
    const { versionName, versionDescription } = body;
    const userId = user._id.toString();

    //1. Build subject context for permissions
    if (!ability.can(CourseActions.Create, 'Course')) {
      throw new ForbiddenError('You do not have permission to create courses');
    }

    //2. Create course and version
    const course = new Course(body);
    const createdCourse = await this.courseService.createCourse(
      course,
      versionName,
      versionDescription,
      userId,
    );
    // //3. Create enrollment for the user
    // await this.enrollmentService.enrollUser(
    //   userId,
    //   createdCourse._id.toString(),
    //   String(createdCourse.versions[0].toString()),
    //   'INSTRUCTOR',
    // );

    setAuditTrail(req, {
      category: AuditCategory.COURSE,
      action: AuditAction.COURSE_CREATE,
      actor: ObjectId.createFromHexString(userId),
      context: {
        courseId: createdCourse._id,
        courseVersionId: createdCourse.versions[createdCourse.versions.length - 1],
      },
      changes: {
        after: {
          title: createdCourse.name,
          description: createdCourse.description,
        }
      },
      outcome: {
        status: OutComeStatus.SUCCESS,
      },
    });

    //3. Return the course details
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
  @Get('/:courseId', { transformResponse: true })
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
  async read(
    @Params() params: CourseIdParams,
    @Ability(getCourseAbility) { ability },
  ) {
    const { courseId } = params;

    // Create a course resource object with the courseId for permission checking
    const courseResource = subject('Course', { courseId });

    // Check permission using ability.can() with the actual course resource
    if (!ability.can(CourseActions.View, courseResource)) {
      throw new ForbiddenError(
        'You do not have permission to view this course',
      );
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
  @Patch('/:courseId', { transformResponse: true })
  @UseInterceptor(AuditTrailsHandler)
  @ResponseSchema(CourseDataResponse, {
    description: 'Course updated successfully',
    statusCode: 200,
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
    @Params() params: CourseIdParams,
    @Body() body: EditCourseBody,
    @Ability(getCourseAbility) { ability, user },
    @Req() req: Request
  ) {
    const { courseId } = params;
    const userId = user._id.toString();
    // Create a course resource object with the courseId for permission checking
    const courseResource = subject('Course', { courseId });

    // Check permission using ability.can() with the actual course resource
    if (!ability.can(CourseActions.Modify, courseResource)) {
      throw new ForbiddenError(
        'You do not have permission to update this course',
      );
    }
    const courseBeforeUpdate = await this.courseService.readCourse(courseId);
    const updatedCourse = await this.courseService.updateCourse(courseId, body);
    const lastIndex = updatedCourse.versions.length - 1 || 0;
    setAuditTrail(req, {
      category: AuditCategory.COURSE,
      action: AuditAction.COURSE_UPDATE,
      actor: ObjectId.createFromHexString(userId),
      context: {
        courseId: ObjectId.createFromHexString(courseId),
        courseVersionId: updatedCourse.versions[lastIndex],
      },
      changes: {
        before: {
          title: courseBeforeUpdate.name,
          description: courseBeforeUpdate.description,
        },
        after: {
          title: updatedCourse.name,
          description: updatedCourse.description,
        },
      },
       outcome:{
          status: OutComeStatus.SUCCESS,
        }
      
    })
    return updatedCourse;
  }

  @OpenAPI({
    summary: 'Delete a course',
    description: `Deletes a course by ID<br/>
    It returns an empty body with a 200 status code.`,
  })
  @Authorized()
  @Delete('/:courseId', { transformResponse: true })
  @UseInterceptor(AuditTrailsHandler)
  @OnUndefined(200)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(CourseNotFoundErrorResponse, {
    description: 'Course not found',
    statusCode: 404,
  })
  async delete(
    @Params() params: CourseIdParams,
    @Ability(getCourseAbility) { ability, user },
    @Req() req: Request
  ) {
    const { courseId } = params;
    const userId = user._id.toString();
    // Create a course resource object with the courseId for permission checking
    const courseResource = subject('Course', { courseId });

    // Check permission using ability.can() with the actual course resource
    if (!ability.can(CourseActions.Delete, courseResource)) {
      throw new ForbiddenError(
        'You do not have permission to delete this course',
      );
    }
    if (courseId == '692f030a945e82ec875e9116') {
      // MERN CASE Study check
      throw new BadRequestError("You can't delete this course!");
    }

    const courseBeforeDelete = await this.courseService.readCourse(courseId);

    setAuditTrail(req, {
      category: AuditCategory.COURSE,
      action: AuditAction.COURSE_DELETE,
      actor: ObjectId.createFromHexString(userId),
      context: {
        courseId: ObjectId.createFromHexString(courseId),
        courseVersionId: courseBeforeDelete.versions[courseBeforeDelete.versions.length - 1],
      },
      changes: {
        before: {
          title: courseBeforeDelete.name,
          description: courseBeforeDelete.description,
        },
      },
       outcome:{
          status: OutComeStatus.SUCCESS,
        }
    })

    await this.courseService.deleteCourse(courseId);
  }

  @OpenAPI({
    summary: 'Update Course Version Total Item Count',
    description:
      'Updates the total item count for a specific course version by ID.<br/> It returns an empty body with a 200 status code.',
  })
  @Authorized()
  @Patch('/version/total-item-count', { transformResponse: true })
  @ResponseSchema(ActiveUsersResponseDto, { statusCode: 200 })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(CourseNotFoundErrorResponse, {
    description: 'Course or Course Version not found',
    statusCode: 404,
  })
  async updateCourseVersionTotalItemCount(
    @Ability(getCourseAbility) { ability },
    @QueryParams() query: CourseVersionQuery,
  ) {
    const { courseId, courseVersionId } = query;
    // Update total item count in service
    const updatedVersion = await this.courseService.updateCourseVersionTotalItemCount(courseId, courseVersionId);
    return updatedVersion;
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
