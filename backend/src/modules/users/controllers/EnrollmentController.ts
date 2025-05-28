import 'reflect-metadata';
import {
  JsonController,
  Post,
  HttpCode,
  Params,
  Authorized,
  BadRequestError,
  Get,
  NotFoundError,
  Param,
  QueryParam,
  InternalServerError,
} from 'routing-controllers';
import {Inject, Service} from 'typedi';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {
  EnrollmentParams,
  EnrollmentNotFoundErrorResponse,
  EnrollUserResponseData,
  EnrollmentResponse,
} from '../classes/validators/EnrollmentValidators';

import {EnrollmentService} from '../services';
import {EnrollUserResponse} from '../classes/transformers';
import {BadRequestErrorResponse} from 'shared/middleware/errorHandler';
/**
 * Controller for managing student enrollments in courses.
 *
 * @category Users/Controllers
 */
@OpenAPI({
  tags: ['User Enrollments'],
})
@JsonController('/users', {transformResponse: true})
@Service()
export class EnrollmentController {
  constructor(
    @Inject('EnrollmentService')
    private readonly enrollmentService: EnrollmentService,
  ) {}

  @Authorized(['student']) // Or use another role or remove if not required
  @Post('/:userId/enrollments/courses/:courseId/versions/:courseVersionId')
  @HttpCode(200)
  @OpenAPI({
    summary: 'Enroll User in Course',
    description: 'Enrolls a user in a specific version of a course.',
  })
  @ResponseSchema(EnrollUserResponseData, {
    description: 'User successfully enrolled in the course',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(EnrollmentNotFoundErrorResponse, {
    description: 'Enrollment could not be created or found',
    statusCode: 404,
  })
  async enrollUser(
    @Params() params: EnrollmentParams,
  ): Promise<EnrollUserResponse> {
    const {userId, courseId, courseVersionId} = params;

    const responseData = await this.enrollmentService.enrollUser(
      userId,
      courseId,
      courseVersionId,
    );

    return new EnrollUserResponse(
      responseData.enrollment,
      responseData.progress,
    );
  }
  @Authorized(['student'])
  @Post(
    '/:userId/enrollments/courses/:courseId/versions/:courseVersionId/unenroll',
  )
  @HttpCode(200)
  @OpenAPI({
    summary: 'Unenroll User from Course',
    description: 'Unenrolls a user from a specific version of a course.',
  })
  @ResponseSchema(EnrollUserResponseData, {
    description: 'User successfully unenrolled from the course',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(EnrollmentNotFoundErrorResponse, {
    description: 'Enrollment could not be found or already removed',
    statusCode: 404,
  })
  @Authorized(['student'])
  @Post(
    '/:userId/enrollments/courses/:courseId/versions/:courseVersionId/unenroll',
  )
  @HttpCode(200)
  @OpenAPI({
    summary: 'Unenroll User from Course',
    description: 'Unenrolls a user from a specific version of a course.',
  })
  @ResponseSchema(EnrollUserResponseData, {
    description: 'User successfully unenrolled from the course',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  @ResponseSchema(EnrollmentNotFoundErrorResponse, {
    description: 'Enrollment could not be found or already removed',
    statusCode: 404,
  })
  async unenrollUser(
    @Params() params: EnrollmentParams,
  ): Promise<EnrollUserResponse> {
    const {userId, courseId, courseVersionId} = params;

    const responseData = await this.enrollmentService.unenrollUser(
      userId,
      courseId,
      courseVersionId,
    );

    return new EnrollUserResponse(
      responseData.enrollment,
      responseData.progress,
    );
  }

  @Authorized(['student'])
  @Get('/:userId/enrollments')
  @HttpCode(200)
  @OpenAPI({
    summary: 'Get User Enrollments',
    description:
      'Retrieves a paginated list of courses and course versions a user is enrolled in.',
  })
  @ResponseSchema(EnrollmentResponse, {
    description: 'List of user enrollments',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    statusCode: 400,
    description: 'Bad Request',
  })
  @ResponseSchema(EnrollmentNotFoundErrorResponse, {
    statusCode: 404,
    description: 'Enrollments Not Found',
  })
  async getUserEnrollments(
    @Param('userId') userId: string,
    @QueryParam('page') page = 1,
    @QueryParam('limit') limit = 10,
  ): Promise<EnrollmentResponse> {
    try {
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
    } catch (error) {
      if (error instanceof BadRequestError || error instanceof NotFoundError) {
        throw error;
      }
      throw new Error('An unexpected error occurred.');
    }
  }
}
