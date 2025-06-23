
import { EnrollmentRole, IEnrollment, IProgress } from '#root/shared/interfaces/models.js';
import {
  EnrolledUserResponse,
  EnrollUserResponse,
} from '#users/classes/transformers/Enrollment.js';
import {
  EnrollmentParams,
  EnrollmentBody,
  EnrollmentResponse,
  EnrollmentNotFoundErrorResponse,
} from '#users/classes/validators/EnrollmentValidators.js';
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
  QueryParam,
  BadRequestError,
  NotFoundError,
  Body,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';

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
    description: 'Enrolls a user in a specific course version with a given role.',
  })
  @Post('/:userId/enrollments/courses/:courseId/versions/:courseVersionId')
  @HttpCode(200)
  @ResponseSchema(EnrollUserResponse, {
    description: 'User enrolled successfully',
  })
  @ResponseSchema(EnrollmentNotFoundErrorResponse, {
    description: 'User or course version not found',
    statusCode: 404,
  })
  @ResponseSchema(BadRequestError, {
    description: 'Invalid role or User already enrolled',
    statusCode: 400,
  })
  async enrollUser(
    @Params() params: EnrollmentParams,
    @Body() body: EnrollmentBody,
  ): Promise<EnrollUserResponse> {
    const { userId, courseId, courseVersionId } = params;
    const { role } = body;
    const responseData = await this.enrollmentService.enrollUser(
      userId,
      courseId,
      courseVersionId,
      role,
    ) as { enrollment: IEnrollment; progress: IProgress; role: EnrollmentRole };

    return new EnrollUserResponse(
      responseData.enrollment,
      responseData.progress,
      responseData.role,
    );
  }

  @OpenAPI({
    summary: 'Unenroll a user from a course version',
    description: 'Removes a user\'s enrollment and progress from a specific course version.',
  })
  @Post('/:userId/enrollments/courses/:courseId/versions/:courseVersionId/unenroll')
  @HttpCode(200)
  @ResponseSchema(EnrollUserResponse, {
    description: 'User unenrolled successfully',
    statusCode: 200,
  })
  @ResponseSchema(EnrollmentNotFoundErrorResponse, {
    description: 'Enrollment not found for the user in the specified course version',
    statusCode: 404,
  })
  async unenrollUser(
    @Params() params: EnrollmentParams,
  ): Promise<EnrollUserResponse> {
    const { userId, courseId, courseVersionId } = params;

    const responseData = await this.enrollmentService.unenrollUser(
      userId,
      courseId,
      courseVersionId,
    );

    return new EnrollUserResponse(
      responseData.enrollment,
      responseData.progress,
      responseData.role,
    );
  }

  @OpenAPI({
    summary: 'Get all enrollments for a user',
    description: 'Retrieves a paginated list of all course enrollments for a user.',
  })
  @Get('/:userId/enrollments')
  @HttpCode(200)
  @ResponseSchema(EnrollmentResponse, {
    description: 'Paginated list of user enrollments',
  })
  @ResponseSchema(EnrollmentNotFoundErrorResponse, {
    description: 'No enrollments found for the user',
    statusCode: 404,
  })
  @ResponseSchema(BadRequestError, {
    description: 'Invalid page or limit parameters',
    statusCode: 400,
  })
  async getUserEnrollments(
    @Param('userId') userId: string,
    @QueryParam('page') page = 1,
    @QueryParam('limit') limit = 10,
  ): Promise<EnrollmentResponse> {
    //convert page and limit to integers
    page = parseInt(page as unknown as string, 10);
    limit = parseInt(limit as unknown as string, 10);

    if (page < 1 || limit < 1) {
      throw new BadRequestError('Page and limit must be positive integers.');
    }
    const skip = (page - 1) * limit;

    const enrollments = await this.enrollmentService.getEnrollments(
      userId,
      skip,
      limit,
    );
    const totalDocuments =
      await this.enrollmentService.countEnrollments(userId);

    if (!enrollments || enrollments.length === 0) {
      throw new NotFoundError('No enrollments found for the given user.');
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
    description: 'Retrieves enrollment details, including role and status, for a user in a specific course version.',
  })
  @Get('/:userId/enrollments/courses/:courseId/versions/:courseVersionId')
  @HttpCode(200)
  @ResponseSchema(EnrolledUserResponse, {
    description: 'Enrollment details for the user in the course version',
  })
  @ResponseSchema(EnrollmentNotFoundErrorResponse, {
    description: 'Enrollment not found for the user in the specified course version',
    statusCode: 404,
  })
  async getEnrollment(
    @Params() params: EnrollmentParams,
  ): Promise<EnrolledUserResponse> {
    const { userId, courseId, courseVersionId } = params;
    const enrollmentData = await this.enrollmentService.findEnrollment(
      userId,
      courseId,
      courseVersionId,
    );
    return new EnrolledUserResponse(
      enrollmentData.role,
      enrollmentData.status,
      enrollmentData.enrollmentDate,
    );
  }
}
