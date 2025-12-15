import {
  BulkEnrollmentsQuery,
  EnrollmentFilterQuery,
  EnrollmentRole,
  EnrollmentsQuery,
  IEnrollment,
  IProgress,
} from '#root/shared/interfaces/models.js';
import {
  EnrolledUserResponse,
  EnrollUserResponse,
} from '#users/classes/transformers/Enrollment.js';
import {
  EnrollmentParams,
  EnrollmentBody,
  EnrollmentResponse,
  EnrollmentNotFoundErrorResponse,
  CourseVersionEnrollmentResponse,
  EnrollmentStatisticsResponse,
  UpdateEnrollmentProgressResponse,
} from '#users/classes/validators/EnrollmentValidators.js';
import {QuizScoresExportResponseDto} from '../dtos/QuizScoresExportDto.js';
import {EnrollmentService} from '#users/services/EnrollmentService.js';
import {AttemptService} from '#root/modules/quizzes/services/AttemptService.js';
import {USERS_TYPES} from '#users/types.js';
import {injectable, inject} from 'inversify';
import {
  JsonController,
  Post,
  HttpCode,
  Params,
  Get,
  Param,
  BadRequestError,
  NotFoundError,
  Body,
  ForbiddenError,
  Authorized,
  QueryParams,
  Patch,
  Req,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {
  EnrollmentActions,
  getEnrollmentAbility,
} from '../abilities/enrollmentAbilities.js';
import {Ability} from '#root/shared/functions/AbilityDecorator.js';
import {subject} from '@casl/ability';
import {ICourseRepository} from '#root/shared/database/interfaces/ICourseRepository.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {QUIZZES_TYPES} from '#root/modules/quizzes/types.js';
import {BadRequestErrorResponse} from '#root/shared/index.js';
import {QuizNotFoundErrorResponse} from '#root/modules/quizzes/classes/index.js';

@OpenAPI({
  tags: ['Enrollments'],
})
@JsonController('/users', {transformResponse: true})
@injectable()
export class EnrollmentController {
  constructor(
    @inject(USERS_TYPES.EnrollmentService)
    private readonly enrollmentService: EnrollmentService,
    @inject(QUIZZES_TYPES.AttemptService)
    private readonly attemptService: AttemptService,
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,
  ) {}

  private async getContentCounts(
    courseVersionId: string,
  ): Promise<{videos: number; quizzes: number; articles: number}> {
    return {
      videos: 24,
      quizzes: 12,
      articles: 9,
    };
  }

  @OpenAPI({
    summary: 'Enroll a user in a course version',
    description:
      'Enrolls a user in a specific course version with a given role.',
  })
  @Authorized()
  @Post('/:userId/enrollments/courses/:courseId/versions/:versionId')
  @HttpCode(200)
  @ResponseSchema(EnrollUserResponse, {
    description: 'User enrolled successfully',
  })
  @ResponseSchema(EnrollmentNotFoundErrorResponse, {
    description: 'User or course version not found',
    statusCode: 404,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid role or User already enrolled',
    statusCode: 400,
  })
  async enrollUser(
    @Params() params: EnrollmentParams,
    @Body() body: EnrollmentBody,
    @Ability(getEnrollmentAbility) {ability},
  ): Promise<EnrollUserResponse> {
    const {userId, courseId, versionId} = params;

    // Create an enrollment resource object for permission checking
    const enrollmentResource = subject('Enrollment', {
      userId,
      courseId,
      versionId,
    });

    // Check permission using ability.can() with the actual enrollment resource
    if (!ability.can(EnrollmentActions.Create, enrollmentResource)) {
      throw new ForbiddenError(
        'You do not have permission to enroll users in this course',
      );
    }

    const {role} = body;
    const responseData = (await this.enrollmentService.enrollUser(
      userId,
      courseId,
      versionId,
      role,
    )) as {enrollment: IEnrollment; progress: IProgress; role: EnrollmentRole};

    return new EnrollUserResponse(
      responseData.enrollment,
      responseData.progress,
      responseData.role,
    );
  }

  @OpenAPI({
    summary: 'Unenroll a user from a course version',
    description:
      "Removes a user's enrollment and progress from a specific course version.",
  })
  @Authorized()
  @Post('/:userId/enrollments/courses/:courseId/versions/:versionId/unenroll')
  @HttpCode(200)
  @ResponseSchema(EnrollUserResponse, {
    description: 'User unenrolled successfully',
    statusCode: 200,
  })
  @ResponseSchema(EnrollmentNotFoundErrorResponse, {
    description:
      'Enrollment not found for the user in the specified course version',
    statusCode: 404,
  })
  async unenrollUser(
    @Params() params: EnrollmentParams,
    @Ability(getEnrollmentAbility) {ability},
  ): Promise<EnrollUserResponse> {
    const {userId, courseId, versionId} = params;
    const enrollmentData = await this.enrollmentService.findEnrollment(
      userId,
      courseId,
      versionId,
    );
    // Create an enrollment resource object for permission checking
    const enrollmentResource = subject('Enrollment', {
      courseId,
      versionId,
      role: enrollmentData.role,
    });

    // Check permission using ability.can() with the actual enrollment resource
    if (!ability.can(EnrollmentActions.Delete, enrollmentResource)) {
      throw new ForbiddenError(
        'You do not have permission to unenroll users from this course',
      );
    }

    console.log(
      'Unenrolling user:',
      userId,
      'from course:',
      courseId,
      'version:',
      versionId,
    );
    const responseData = await this.enrollmentService.unenrollUser(
      userId,
      courseId,
      versionId,
      enrollmentData,
    );

    return new EnrollUserResponse(
      responseData.enrollment,
      responseData.progress,
      responseData.role,
    );
  }

  @OpenAPI({
    summary: 'Get all enrollments for a user',
    description:
      'Retrieves a paginated list of all course enrollments for a user.',
  })
  @Authorized()
  @Get('/enrollments')
  @HttpCode(200)
  @ResponseSchema(EnrollmentResponse, {
    description: 'Paginated list of user enrollments',
  })
  @ResponseSchema(EnrollmentNotFoundErrorResponse, {
    description: 'No enrollments found for the user',
    statusCode: 404,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid page or limit parameters',
    statusCode: 400,
  })
  async getUserEnrollments(
    @QueryParams() query: EnrollmentFilterQuery,
    @Ability(getEnrollmentAbility) {user},
    @Req() req: any,
  ): Promise<EnrollmentResponse> {
    const {page, limit, search = '', role} = query;
    const userId = user._id.toString();
    const skip = (page - 1) * limit;
    // console.log("session on the dashboard ", req.session)
    // if (req.session.bulkInviteId) {
    //   console.log("bulk id in session dashboard ", req.session.bulkInviteId)
    //   let result = await this.enrollmentService.processBulkInvite(userId, req.session.bulkInviteId)
    //   console.log("result after enrollment ", result)
    //   delete req.session.bulkInviteId
    //   await new Promise<void>((resolve, reject) => {
    //     req.session.save(err => err ? reject(err) : resolve());
    //   });
    // }
    const enrollments = await this.enrollmentService.getEnrollments(
      userId,
      skip,
      limit,
      role,
      search,
    );

    const totalDocuments = await this.enrollmentService.countEnrollments(
      userId,
      role,
    );

    if (!enrollments || enrollments.length === 0) {
      return {
        totalDocuments: 0,
        totalPages: 0,
        currentPage: page,
        enrollments: [],
        message: 'No enrollments found for the user',
      };
    }

    return {
      totalDocuments,
      totalPages: Math.ceil(totalDocuments / limit),
      currentPage: page,
      enrollments,
    };
  }

  @OpenAPI({
    summary: 'Get enrollment details for a user in a course version',
    description:
      'Retrieves enrollment details, including role and status, for a user in a specific course version.',
  })
  @Authorized()
  @Get('/:userId/enrollments/courses/:courseId/versions/:versionId')
  @HttpCode(200)
  @ResponseSchema(EnrolledUserResponse, {
    description: 'Enrollment details for the user in the course version',
  })
  @ResponseSchema(EnrollmentNotFoundErrorResponse, {
    description:
      'Enrollment not found for the user in the specified course version',
    statusCode: 404,
  })
  async getEnrollment(
    @Params() params: EnrollmentParams,
    @Ability(getEnrollmentAbility) {ability},
  ): Promise<EnrolledUserResponse> {
    const {userId, courseId, versionId} = params;

    // Create an enrollment resource object for permission checking
    const enrollmentResource = subject('Enrollment', {
      userId,
      courseId,
      versionId,
    });

    // Check permission using ability.can() with the actual enrollment resource
    if (!ability.can(EnrollmentActions.ViewAll, enrollmentResource)) {
      throw new ForbiddenError(
        'You do not have permission to view this enrollment',
      );
    }

    const enrollmentData = await this.enrollmentService.findEnrollment(
      userId,
      courseId,
      versionId,
    );
    return new EnrolledUserResponse(
      enrollmentData.role,
      enrollmentData.status,
      enrollmentData.enrollmentDate,
    );
  }

  @OpenAPI({
    summary: 'Get all enrollments for a course version',
    description:
      'Retrieves a paginated list of all users enrolled in a specific course version.',
  })
  @Authorized()
  @Get('/enrollments/courses/:courseId/versions/:versionId')
  @HttpCode(200)
  @ResponseSchema(CourseVersionEnrollmentResponse, {
    description: 'Paginated list of enrollments for the course version',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid page or limit parameters',
    statusCode: 400,
  })
  async getCourseVersionEnrollments(
    @Param('courseId') courseId: string,
    @Param('versionId') versionId: string,
    @QueryParams() query: EnrollmentsQuery,
    @Ability(getEnrollmentAbility) {ability},
  ): Promise<CourseVersionEnrollmentResponse> {
    const enrollmentResource = subject('Enrollment', {courseId, versionId});

    if (!ability.can(EnrollmentActions.ViewAll, enrollmentResource)) {
      throw new ForbiddenError(
        'You do not have permission to view enrollments for this course',
      );
    }

    const {
      page,
      limit,
      search = '',
      sortBy = 'enrollmentDate',
      sortOrder = 'desc',
      filter,
    } = query;

    if (page < 1 || limit < 1) {
      throw new BadRequestError('Page and limit must be positive integers.');
    }

    // const skip = search && search.trim() !== '' ? 0 : (page - 1) * limit;

    const skip = (page - 1) * limit;

    const enrollmentsData =
      await this.enrollmentService.getCourseVersionEnrollments(
        courseId,
        versionId,
        skip,
        limit,
        search,
        sortBy,
        sortOrder,
        filter,
      );

    if (
      !enrollmentsData ||
      !enrollmentsData.enrollments ||
      enrollmentsData.enrollments.length === 0
    ) {
      throw new NotFoundError(
        'No enrollments found for the given course version.',
      );
    }

    const totalDocuments =
      'totalDocuments' in enrollmentsData
        ? enrollmentsData.totalDocuments
        : enrollmentsData.totalCount;

    const totalPages =
      'totalPages' in enrollmentsData
        ? enrollmentsData.totalPages
        : Math.ceil(enrollmentsData.totalCount / limit);

    return {
      enrollments: enrollmentsData.enrollments
        .map((enrollment: any) => ({
          role: enrollment.role,
          status: enrollment.status,
          isDeleted: enrollment.isDeleted || false,
          enrollmentDate: enrollment.enrollmentDate,
          user: {...enrollment.userInfo, _id: enrollment.userId},
          progress: enrollment.percentCompleted,
        }))
        .sort((a, b) => {
          // sort by isDeleted deleted should be at the bottom
          if (a.isDeleted && !b.isDeleted) return 1;
          if (!a.isDeleted && b.isDeleted) return -1;
          return 0;
        }),
      totalDocuments,
      totalPages,
      currentPage: page,
    };
  }
  @OpenAPI({
    summary: 'Update Enrollment Progress',
    description:
      'Recomputes and updates progress for all enrollments across all courses or a specific course if courseId is provided.',
  })
  @Authorized()
  @Patch('/enrollments/progress', {transformResponse: true})
  @ResponseSchema(UpdateEnrollmentProgressResponse, {
    description: 'Enrollment progress updated successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async updateAllEnrollmentsProgress(
    @Ability(getEnrollmentAbility) {ability},
    @QueryParams() query: BulkEnrollmentsQuery,
  ) {
    const {courseId} = query;
    const updatedEnrollment =
      await this.enrollmentService.bulkUpdateAllEnrollments(courseId);
    return updatedEnrollment;
  }

  @OpenAPI({
    summary: 'Get enrollment statistics for a course version',
    description:
      'Provides total enrollments, completed enrollments count, and average progress percentage for a specific course version.',
  })
  @Authorized()
  @Get('/enrollments/courses/:courseId/versions/:versionId/statistics')
  @HttpCode(200)
  @ResponseSchema(EnrollmentStatisticsResponse, {
    description: 'Aggregated enrollment statistics for the course version',
  })
  @ResponseSchema(EnrollmentNotFoundErrorResponse, {
    description: 'No enrollments found for the course version',
    statusCode: 404,
  })
  async getCourseVersionEnrollmentStatistics(
    @Param('courseId') courseId: string,
    @Param('versionId') versionId: string,
    @Ability(getEnrollmentAbility) {ability},
  ): Promise<EnrollmentStatisticsResponse> {
    const enrollmentResource = subject('Enrollment', {courseId, versionId});

    if (!ability.can(EnrollmentActions.ViewAll, enrollmentResource)) {
      throw new ForbiddenError(
        'You do not have permission to view enrollment statistics for this course',
      );
    }

    const stats =
      await this.enrollmentService.getCourseVersionEnrollmentStatistics(
        courseId,
        versionId,
      );

    if (!stats || stats.totalEnrollments === 0) {
      throw new NotFoundError(
        'No enrollments found for the given course version.',
      );
    }

    return stats;
  }
  // @Authorized()
  // @Patch('/enrollments/progress-percent/initialize')
  // @HttpCode(200)
  // @ResponseSchema(ForbiddenError, {
  //   description: 'User does not have permission to update progress percent',
  //   statusCode: 403,
  // })
  // async initializeProgressPercent(
  //   @Ability(getEnrollmentAbility) { ability },
  // ): Promise<void> {

  //   const result = await this.enrollmentService.addProgressPercentToAll(); // default 0%

  // }

  @Get('/enrollments/courses/:courseId/versions/:versionId/export/quiz-scores')
  @Authorized()
  @HttpCode(200)
  @OpenAPI({
    summary: 'Export quiz scores for all students in a course version',
    description:
      'Returns quiz scores for all students in the specified course version',
  })
  //TODO:  We should update this Param to Params in both frontend and backend
  @ResponseSchema(QuizScoresExportResponseDto, {
    description: 'Quiz scores exported successfully',
    statusCode: 200,
  })
  @ResponseSchema(QuizNotFoundErrorResponse, {
    description: 'Course or version not found',
    statusCode: 404,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid request parameters',
    statusCode: 400,
  })
  async exportQuizScores(
    @Param('courseId') courseId: string,
    @Param('versionId') versionId: string,
    @Ability(getEnrollmentAbility) {ability},
  ): Promise<QuizScoresExportResponseDto> {
    const enrollmentResource = subject('Enrollment', {courseId, versionId});

    if (!ability.can(EnrollmentActions.ViewAll, enrollmentResource)) {
      throw new ForbiddenError(
        'You do not have permission to view quiz scores for this course',
      );
    }

    return this.enrollmentService.getQuizScoresForCourseVersion(
      courseId,
      versionId,
    );
  }
}
