import 'reflect-metadata';
import {
  JsonController,
  Post,
  HttpCode,
  Params,
  Authorized,
} from 'routing-controllers';
import {Inject, Service} from 'typedi';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {
  EnrollmentParams,
  EnrollmentNotFoundErrorResponse,
  EnrollUserResponseData,
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

  // ...existing code...
}
