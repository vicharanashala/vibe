import 'reflect-metadata';
import {
  HttpCode,
  HttpError,
  JsonController,
  Params,
  Post,
} from 'routing-controllers';
import {Inject, Service} from 'typedi';
import {EnrollmentParams} from '../classes/validators/EnrollmentValidators';
import {EnrollmentService} from '../services';
import {
  Enrollment,
  EnrollUserResponse,
  Progress,
} from '../classes/transformers';

/**
 * Controller for managing student enrollments in courses.
 *
 * @category Users/Controllers
 */
@JsonController('/users', {transformResponse: true})
@Service()
export class EnrollmentController {
  constructor(
    @Inject('EnrollmentService')
    private readonly enrollmentService: EnrollmentService,
  ) {}

  @Post('/:userId/enrollments/courses/:courseId/versions/:courseVersionId')
  @HttpCode(200)
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
