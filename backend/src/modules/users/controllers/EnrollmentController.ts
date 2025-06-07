import 'reflect-metadata';
import {
  JsonController,
  Post,
  HttpCode,
  Params,
  BadRequestError,
  Get,
  NotFoundError,
  Param,
  QueryParam,
  Body,
} from 'routing-controllers';
import {inject, injectable} from 'inversify';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {
  EnrollmentParams,
  EnrollmentResponse,
  EnrollmentBody,
} from '../classes/validators/EnrollmentValidators';
import {EnrollmentService} from '../services';
import {
  EnrolledUserResponse,
  EnrollUserResponse,
} from '../classes/transformers';
import TYPES from '../types';

@OpenAPI({
  tags: ['User Enrollments'],
})
@JsonController('/users', {transformResponse: true})
@injectable()
export class EnrollmentController {
  constructor(
    @inject(TYPES.EnrollmentService)
    private readonly enrollmentService: EnrollmentService,
  ) {}

  @Post('/:userId/enrollments/courses/:courseId/versions/:courseVersionId')
  @HttpCode(200)
  @OpenAPI({
    summary: 'Enroll user in course',
    description: 'Enroll a user in a specific course version with a given role',
  })
  @ResponseSchema(EnrollUserResponse, {
    description: 'User enrolled successfully',
  })
  async enrollUser(
    @Params() params: EnrollmentParams,
    @Body() body: EnrollmentBody,
  ): Promise<EnrollUserResponse> {
    const {userId, courseId, courseVersionId} = params;
    const {role} = body;
    const responseData = await this.enrollmentService.enrollUser(
      userId,
      courseId,
      courseVersionId,
      role,
    );

    return new EnrollUserResponse(
      responseData.enrollment,
      responseData.progress,
      responseData.role,
    );
  }

  @Post(
    '/:userId/enrollments/courses/:courseId/versions/:courseVersionId/unenroll',
  )
  @HttpCode(200)
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
      responseData.role,
    );
  }

  @Get('/:userId/enrollments')
  @HttpCode(200)
  @OpenAPI({
    summary: 'Get user enrollments',
    description: 'Retrieve all enrollments for a specific user',
  })
  @ResponseSchema(EnrolledUserResponse, {
    description: 'User enrollments retrieved successfully',
    isArray: true,
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

  @Get('/:userId/enrollments/courses/:courseId/versions/:courseVersionId')
  @HttpCode(200)
  async getEnrollment(
    @Params() params: EnrollmentParams,
  ): Promise<EnrolledUserResponse> {
    const {userId, courseId, courseVersionId} = params;
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
