import { inject, injectable } from "inversify";
import { Authorized, Body, CurrentUser, Delete, ForbiddenError, Get, HttpCode, JsonController, OnUndefined, Params, Patch, Post } from "routing-controllers";
import { OpenAPI, ResponseSchema } from "routing-controllers-openapi";
import { COURSES_TYPES} from "../types.js";
import { EnrollmentService } from "#root/modules/users/services/EnrollmentService.js";
import { CourseService } from "../services/CourseService.js";
import { CourseBody, CourseDataResponse, CourseIdParams, CourseNotFoundErrorResponse, EditCourseBody } from "../classes/validators/courseValidator.js";
import { BadRequestErrorResponse, IUser } from "#root/shared/index.js";
import { Course } from "../classes/transformers/course.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { Ability } from "#root/shared/functions/AbilityDecorator.js";
import { CourseActions, getCourseAbility } from "../abilities/courseAbilities.js";
import { USERS_TYPES } from "#root/modules/users/types.js";
import { subject } from "@casl/ability";


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
    summary: 'Create a new course',
    description: 'Creates a new course in the system.<br/>.',
  })
  @Authorized()
  @Post('/', { transformResponse: true })
  @HttpCode(201)
  @ResponseSchema(CourseDataResponse, {
    description: 'Course created successfully',
    statusCode:201
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async create(
    @Body() body: CourseBody,
    // @Ability(getCourseAbility) { ability, user },
    @CurrentUser() user:IUser
  ): Promise<Course> {
    const { versionName, versionDescription } = body;
    const userId = user._id.toString();
    //1. Build subject context for permissions
    // if (!ability.can(CourseActions.Create, 'Course')) {
    //   throw new ForbiddenError('You do not have permission to create courses');
    // }

    //2. Create course and version
    // const userId=''
    const course = new Course(body);
    const createdCourse = await this.courseService.createCourse(
      course,
      versionName,
      versionDescription,
      userId
    );

    // //3. Create enrollment for the user
    // await this.enrollmentService.enrollUser(
    //   userId,
    //   createdCourse._id.toString(),
    //   String(createdCourse.versions[0].toString()),
    //   'INSTRUCTOR',
    // );

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
  @ResponseSchema(CourseDataResponse, {
    description: 'Course updated successfully',
    statusCode:200
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
    // @Ability(getCourseAbility) { ability },
  ) {
    const { courseId } = params;

    // Create a course resource object with the courseId for permission checking
    // const courseResource = subject('Course', { courseId });

    // Check permission using ability.can() with the actual course resource
    // if (!ability.can(CourseActions.Modify, courseResource)) {
    //   throw new ForbiddenError(
    //     'You do not have permission to update this course',
    //   );
    // }

    const updatedCourse = await this.courseService.updateCourse(courseId, body);
    return updatedCourse;
  }



   @OpenAPI({
    summary: 'Delete a course',
    description: `Deletes a course by ID<br/>
    It returns an empty body with a 200 status code.`,
  })
  @Authorized()
  @Delete('/:courseId', { transformResponse: true })
  // @OnUndefined(200)
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
    @Ability(getCourseAbility) { ability },
  ):Promise<any> {
    const { courseId } = params;

    // Create a course resource object with the courseId for permission checking
    // const courseResource = subject('Course', { courseId });

    // // Check permission using ability.can() with the actual course resource
    // if (!ability.can(CourseActions.Delete, courseResource)) {
    //   throw new ForbiddenError(
    //     'You do not have permission to delete this course',
    //   );
    // }

    const result = await this.courseService.deleteCourse(courseId);
    return {message:"Course Deleted Succesfully"}
  }
}
