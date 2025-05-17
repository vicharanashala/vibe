import 'reflect-metadata';
import {
  HttpCode,
  HttpError,
  JsonController,
  Params,
  Post,
} from 'routing-controllers';
import {Inject, Service} from 'typedi';
import {
  EnrollmentParams,
  EnrollUserResponseData,
} from '../classes/validators/EnrollmentValidators';
import {EnrollmentService} from '../services';
import {
  Enrollment,
  EnrollUserResponse,
  Progress,
} from '../classes/transformers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {BadRequestErrorResponse} from 'shared/middleware/errorHandler';

@JsonController('/users', {transformResponse: true})
@Service()
@OpenAPI({
  tags: ['User Enrollments'],
})
export class EnrollmentController {
  constructor(
    @Inject('EnrollmentService')
    private readonly enrollmentService: EnrollmentService,
  ) {}

  @Post('/:userId/enrollments/courses/:courseId/versions/:courseVersionId')
  @HttpCode(200)
  @OpenAPI({
    summary: 'Enroll User in Course',
    description:
      'Enrolls a user in a specific course version and initializes their progress.',
  })
  @ResponseSchema(EnrollUserResponseData, {
    description: 'User enrolled successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
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
}
