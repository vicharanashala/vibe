import { inject, injectable } from "inversify";
import { Authorized, Body, CurrentUser, ForbiddenError, HttpCode, JsonController, Post } from "routing-controllers";
import { OpenAPI, ResponseSchema } from "routing-controllers-openapi";
import { COURSES_TYPES} from "../types.js";
import { EnrollmentService } from "#root/modules/users/services/EnrollmentService.js";
import { CourseService } from "../services/CourseService.js";
import { CourseBody, CourseDataResponse } from "../classes/validators/courseValidator.js";
import { BadRequestErrorResponse, IUser } from "#root/shared/index.js";
import { Course } from "../classes/transformers/course.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { Ability } from "#root/shared/functions/AbilityDecorator.js";
import { CourseActions, getCourseAbility } from "../abilities/courseAbilities.js";
import { USERS_TYPES } from "#root/modules/users/types.js";


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
}
