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
  BulkUnenrollBody,
  BulkUnenrollResponse,
} from '#users/classes/validators/EnrollmentValidators.js';
import { QuizScoresExportResponseDto } from '../dtos/QuizScoresExportDto.js';
import { EnrollmentService } from '#users/services/EnrollmentService.js';

import { USERS_TYPES } from '#users/types.js';
import { injectable, inject } from 'inversify';
import {
  JsonController,
  Post,
  HttpCode,
  Params,
  Get,
  Param,
  BadRequestError,
  Body,
  ForbiddenError,
  Authorized,
  QueryParams,
  Patch,
  Req,
  QueryParam,
  UseInterceptor,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import {
  EnrollmentActions,
  getEnrollmentAbility,
} from '../abilities/enrollmentAbilities.js';
import { Ability } from '#root/shared/functions/AbilityDecorator.js';
import { subject } from '@casl/ability';

import {  BadRequestErrorResponse } from '#root/shared/index.js';
import { AuditTrailsHandler } from '#root/shared/middleware/auditTrails.js';
import { QuizNotFoundErrorResponse } from '#root/modules/quizzes/classes/index.js';
import { setAuditTrail } from '#root/utils/setAuditTrail.js';
import { AuditAction, AuditCategory, OutComeStatus } from '#root/modules/auditTrails/interfaces/IAuditTrails.js';
import { ObjectId } from 'mongodb';

@OpenAPI({
  tags: ['Enrollments'],
})
@JsonController('/users', { transformResponse: true })
@injectable()
export class EnrollmentController {
  constructor(
    @inject(USERS_TYPES.EnrollmentService)
    private readonly enrollmentService: EnrollmentService,
  ) { }

  @OpenAPI({
    summary: 'Enroll a user in a course version',
    description:
      'Enrolls a user in a specific course version with a given role.',
  })
  @Authorized()
  @Post('/:userId/enrollments/courses/:courseId/versions/:versionId')
  @UseInterceptor(AuditTrailsHandler)
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
    @Ability(getEnrollmentAbility) {ability, user},
    @Req() req: Request,
  ): Promise<EnrollUserResponse> {
    const { userId, courseId, versionId } = params;

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

    const { role } = body;
    const responseData = (await this.enrollmentService.enrollUser(
      userId,
      courseId,
      versionId,
      role,
    )) as {enrollment: IEnrollment; progress: IProgress; role: EnrollmentRole};

    setAuditTrail(req,{
      category: AuditCategory.ENROLLMENT,
      action: AuditAction.ENROLLMENT_ADD,
      actor: ObjectId.createFromHexString(user._id.toString()),
      context: {
        courseId: ObjectId.createFromHexString(courseId),
        courseVersionId: ObjectId.createFromHexString(versionId),
        userId: ObjectId.createFromHexString(userId)
      },
      changes:{
        after:{
          role: body.role
        }
      },
      outcome:{
        status: OutComeStatus.SUCCESS
      }
    })

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
  @UseInterceptor(AuditTrailsHandler)
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
    @Ability(getEnrollmentAbility) {ability, user},
    @Req() req: Request,
  ): Promise<EnrollUserResponse> {
    const { userId, courseId, versionId } = params;
    const enrollmentData = await this.enrollmentService.findActiveEnrollment(
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

    const responseData = await this.enrollmentService.unenrollUser(
      userId,
      courseId,
      versionId,
      enrollmentData,
    );

      setAuditTrail(req,{
      category: AuditCategory.ENROLLMENT,
      action: enrollmentData.role === "INSTRUCTOR" ? AuditAction.ENROLLMENT_REMOVE_INSTRUCTOR : AuditAction.ENROLLMENT_REMOVE_STUDENT,
      actor: ObjectId.createFromHexString(user._id.toString()),
      context: {
        courseId: ObjectId.createFromHexString(courseId),
        courseVersionId: ObjectId.createFromHexString(versionId),
        userId: ObjectId.createFromHexString(userId)
      },
      changes:{
        before:{
          role: enrollmentData.role
        }
      },
      outcome:{
        status: OutComeStatus.SUCCESS
      }

      })

    return new EnrollUserResponse(
      responseData.enrollment,
      responseData.progress,
      responseData.role,
    );
  }

  @OpenAPI({
    summary: 'Bulk unenroll users from a course version',
    description:
      "Removes multiple users' enrollments and progress from a specific course version.",
  })
  @Authorized()
  @Post('/enrollments/courses/:courseId/versions/:versionId/bulk-unenroll')
  @UseInterceptor(AuditTrailsHandler)
  @HttpCode(200)
  @ResponseSchema(BulkUnenrollResponse, {
    description: 'Users unenrolled successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid request or missing user IDs',
    statusCode: 400,
  })
  async bulkUnenrollUsers(
    @Param('courseId') courseId: string,
    @Param('versionId') versionId: string,
    @Body() body: BulkUnenrollBody,
    @Ability(getEnrollmentAbility) {ability, user},
    @Req() req: Request,
  ): Promise<BulkUnenrollResponse> {
    const { userIds } = body;

    if (!userIds || userIds.length === 0) {
      throw new BadRequestError(
        'User IDs array is required and cannot be empty',
      );
    }

    // Check permissions for bulk unenroll
    const enrollmentResource = subject('Enrollment', {
      courseId,
      versionId,
    });

    if (!ability.can(EnrollmentActions.Delete, enrollmentResource)) {
      throw new ForbiddenError(
        'You do not have permission to unenroll users from this course',
      );
    }


    const results = await this.enrollmentService.bulkUnenrollUsers(
      userIds,
      courseId,
      versionId,
    );

    setAuditTrail(req, {
      category: AuditCategory.ENROLLMENT,
      action: AuditAction.BULK_ENROLLMENT_REMOVE,
      actor: ObjectId.createFromHexString(user._id.toString()),
      context:{
        courseId: ObjectId.createFromHexString(courseId),
        courseVersionId: ObjectId.createFromHexString(versionId),
      },
      changes:{
        after:{
          totalRequested: userIds.length,
          successCount: results.successCount,
          failureCount: results.failureCount,
          errors: results.errors,
          userId: userIds.map(id => new ObjectId(id))
        }
      },
      outcome:{
        status: OutComeStatus.SUCCESS
      }
    })

    return {
      success: true,
      totalRequested: userIds.length,
      successCount: results.successCount,
      failureCount: results.failureCount,
      errors: results.errors,
    };
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
    @Ability(getEnrollmentAbility) { user },
    @Req() req: any,
  ): Promise<EnrollmentResponse> {
    const { page, limit, search = '', role } = query;
    const userId = user._id.toString();
    const skip = (page - 1) * limit;

    // 🚀 Run DB queries in parallel
    const [enrollments, totalDocuments] = await Promise.all([
      this.enrollmentService.getEnrollments(userId, skip, limit, role, search),
      this.enrollmentService.countEnrollments(userId, role, search),
    ]);

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
    @Ability(getEnrollmentAbility) { ability },
  ): Promise<EnrolledUserResponse> {
    const { userId, courseId, versionId } = params;

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
    @Ability(getEnrollmentAbility) { ability },
  ): Promise<CourseVersionEnrollmentResponse> {
    const enrollmentResource = subject('Enrollment', { courseId, versionId });

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
      statusTab = 'ACTIVE',
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
        statusTab,
      );

    if (
      !enrollmentsData ||
      !enrollmentsData.enrollments ||
      enrollmentsData.enrollments.length === 0
    ) {
      return {
        enrollments: [],
        totalDocuments: 0,
        totalPages: 0,
        currentPage: page,
      };
    }

    const totalDocuments =
      'totalDocuments' in enrollmentsData
        ? enrollmentsData.totalDocuments
        : enrollmentsData.totalCount;

    const totalPages =
      'totalPages' in enrollmentsData
        ? enrollmentsData.totalPages
        : Math.ceil(totalDocuments / limit);

    return {
      enrollments: enrollmentsData.enrollments
        .map((enrollment: any) => ({
          role: enrollment.role,
          status: enrollment.status,
          isDeleted: enrollment.isDeleted || false,
          enrollmentDate: enrollment.enrollmentDate,
          unenrolledAt: enrollment.unenrolledAt,
          user: { ...enrollment.userInfo, _id: enrollment.userId },
          progress: enrollment.percentCompleted,
          completedItemsCount: enrollment.completedItemsCount || 0,
          totalQuizScore: enrollment.totalQuizScore || 0,
          totalQuizMaxScore: enrollment.totalQuizMaxScore || 0,
          contentCounts: enrollment.contentCounts,
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
  @UseInterceptor(AuditTrailsHandler)
  @ResponseSchema(UpdateEnrollmentProgressResponse, {
    description: 'Enrollment progress updated successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async updateAllEnrollmentsProgress(
    @Ability(getEnrollmentAbility) {ability, user},
    @QueryParams() query: BulkEnrollmentsQuery,
    @Req() req: any,
  ) {
    const { courseId, userId } = query;
    const updatedEnrollment =
      await this.enrollmentService.bulkUpdateAllEnrollments(courseId, userId);

      setAuditTrail(req, {
        category: AuditCategory.ENROLLMENT,
        action: AuditAction.PROGRESS_RECALCULATE,
        actor: ObjectId.createFromHexString(user._id.toString()),
        context: {
          courseId: courseId ? ObjectId.createFromHexString(courseId) : undefined,
          userId: userId ? ObjectId.createFromHexString(userId) : undefined,
        },
        changes:{
          after:{
            totalCount: updatedEnrollment.totalCount,
            progressUpdatedCount: updatedEnrollment.updatedCount
          }
        },

        outcome:{
          status: OutComeStatus.SUCCESS
        }
      })
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
    @Ability(getEnrollmentAbility) { ability },
  ): Promise<EnrollmentStatisticsResponse> {
    const enrollmentResource = subject('Enrollment', { courseId, versionId });

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
      return {
        totalEnrollments: 0,
        completedCount: 0,
        averageProgressPercent: 0,
      };
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
    @QueryParam('statusTab') statusTab: 'ACTIVE' | 'INACTIVE' = 'ACTIVE',
    @Ability(getEnrollmentAbility) { ability },
  ): Promise<QuizScoresExportResponseDto> {
    const enrollmentResource = subject('Enrollment', { courseId, versionId });

    if (!ability.can(EnrollmentActions.ViewAll, enrollmentResource)) {
      throw new ForbiddenError(
        'You do not have permission to view quiz scores for this course',
      );
    }

    return this.enrollmentService.getQuizScoresForCourseVersion(
      courseId,
      versionId,
      statusTab,
    );
  }
  @OpenAPI({
    summary: 'Update completed items count for all enrollments',
    description:
      'Endpoint to update completedItemsCount field for all enrollments',
  })
  @Authorized()
  @Patch('/enrollments/update-completed-items-count')
  @ResponseSchema(UpdateEnrollmentProgressResponse, {
    description: 'Completed items count updated successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async updateAllCompletedItemsCount(
    @Ability(getEnrollmentAbility) { ability },
    @QueryParams() query: BulkEnrollmentsQuery,
  ): Promise<{ message: string; totalUpdated: any }> {
    const { courseId, userId } = query;
    const totalUpdated =
      await this.enrollmentService.bulkUpdateCompletedItemsCountParallelPerCourseVersion(
        courseId,
        userId,
      );

    return {
      message: 'Completed items count updated successfully',
      totalUpdated,
    };
  }

  @OpenAPI({
    summary: 'Bulk updates watchtime, progress and completeCounts ',
    description:
      'Endpoint to update watchtime, progress and completeCounts for all enrollments',
  })
  @Authorized()
  @Patch('/enrollments/bulk-update-watchtime-progress-completeCounts')
  @ResponseSchema(UpdateEnrollmentProgressResponse, {
    description: 'Completed items count updated successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async bulk_update_watchtime_progress_completeCounts(
    @Ability(getEnrollmentAbility) { ability },
    @QueryParams() query: BulkEnrollmentsQuery,
  ): Promise<{
    message: string;
    watchtimeUpdated: number;
    progressRecalculated: number;
  }> {
    try {
      const { courseId, versionId, userId } = query;
      const hasAtleastOneParam = courseId || userId || versionId;

      // Validate at least one parameter is provided
      if (!hasAtleastOneParam) {
        throw new BadRequestError(
          'At least courseId, versionId, or userId must be provided',
        );
      }

      // Call the new service method that combines both operations
      const result =
        await this.enrollmentService.bulkUpdateWatchTimeAndRecalculateProgress(
          courseId,
          versionId,
          userId,
        );

      return {
        message: result.message,
        watchtimeUpdated: result.summary.watchtimeUpdated,
        progressRecalculated: result.summary.progressRecalculated,
      };
    } catch (error) {
      console.error(
        'Error in bulk_update_watchtime_progress_completeCounts:',
        error,
      );
      throw new BadRequestError(
        error.message || 'Failed to bulk update watchtime and progress',
      );
    }
  }

  @OpenAPI({
    summary: 'Get all detailed enrollments for a user',
    description:
      'Retrieves a paginated list of all course enrollments for a user.',
  })
  @Authorized()
  @Get('/enrollments/details')
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
  async getUserEnrollmentsDetails(
    @QueryParams() query: EnrollmentFilterQuery,
    @Ability(getEnrollmentAbility) { user },
    @Req() req: any,
  ): Promise<EnrollmentResponse> {
    const { page, limit, search = '', role, courseVersionId } = query;
    const userId = user._id.toString();
    const skip = (page - 1) * limit;

    // 🚀 Run DB queries in parallel
    const [enrollments, totalDocuments] = await Promise.all([
      this.enrollmentService.getDetailedEnrollment(
        userId,
        role,
        courseVersionId,
      ),
      this.enrollmentService.detailedCountEnrollment(
        userId,
        role,
        courseVersionId,
      ),
    ]);

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
    summary: 'Get module-wise progress for a specific user in a course version',
    description:
      'Returns completion statistics for each module for a specific student',
  })
  @Authorized()
  @Get('/:userId/enrollments/courses/:courseId/versions/:versionId/modules/progress')
  @HttpCode(200)
  @ResponseSchema(Object, {
    description: 'Module-wise progress for the student',
  })
  @ResponseSchema(EnrollmentNotFoundErrorResponse, {
    description: 'Enrollment not found for the user',
    statusCode: 404,
  })
  async getUserModuleProgress(
    @Params() params: EnrollmentParams,
    @Ability(getEnrollmentAbility) { ability }: any,
  ): Promise<{
    modules: Array<{
      moduleId: string;
      moduleName: string;
      totalItems: number;
      completedItems: number;
    }>;
  }> {
    const { userId, courseId, versionId } = params;

    // Check permission
    const enrollmentResource = subject('Enrollment', {
      userId,
      courseId,
      versionId,
    });

    if (!ability.can(EnrollmentActions.ViewAll, enrollmentResource)) {
      throw new ForbiddenError(
        'You do not have permission to view this enrollment progress',
      );
    }

    const moduleProgress = await this.enrollmentService.getModuleProgressForUser(
      userId,
      courseId,
      versionId,
    );

    return { modules: moduleProgress };
  }
}
