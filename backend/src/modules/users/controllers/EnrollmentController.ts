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
  CourseVersionEnrollmentResponse,
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
  ForbiddenError,
  Authorized,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { EnrollmentActions, getEnrollmentAbility } from '../abilities/enrollmentAbilities.js';
import { Ability } from '#root/shared/functions/AbilityDecorator.js';
import { subject } from '@casl/ability';

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
  @ResponseSchema(BadRequestError, {
    description: 'Invalid role or User already enrolled',
    statusCode: 400,
  })
  async enrollUser(
    @Params() params: EnrollmentParams,
    @Body() body: EnrollmentBody,
    @Ability(getEnrollmentAbility) {ability}
  ): Promise<EnrollUserResponse> {
    const { userId, courseId, versionId } = params;
    
    // Create an enrollment resource object for permission checking
    const enrollmentResource = subject('Enrollment', { 
      userId, 
      courseId, 
      versionId 
    });
    
    // Check permission using ability.can() with the actual enrollment resource
    if (!ability.can(EnrollmentActions.Create, enrollmentResource)) {
      throw new ForbiddenError('You do not have permission to enroll users in this course');
    }
    
    const { role } = body;
    const responseData = await this.enrollmentService.enrollUser(
      userId,
      courseId,
      versionId,
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
  @Authorized()
  @Post('/:userId/enrollments/courses/:courseId/versions/:versionId/unenroll')
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
    @Ability(getEnrollmentAbility) {ability}
  ): Promise<EnrollUserResponse> {
    const { userId, courseId, versionId } = params;
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
      throw new ForbiddenError('You do not have permission to unenroll users from this course');
    }

    const responseData = await this.enrollmentService.unenrollUser(
      userId,
      courseId,
      versionId,
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
  @ResponseSchema(BadRequestError, {
    description: 'Invalid page or limit parameters',
    statusCode: 400,
  })
  async getUserEnrollments(
    @QueryParam('page') page = 1,
    @QueryParam('limit') limit = 10,
    @Ability(getEnrollmentAbility) {ability, user}
  ): Promise<EnrollmentResponse> {
    //convert page and limit to integers
    page = parseInt(page as unknown as string, 10);
    limit = parseInt(limit as unknown as string, 10);
    const userId = user._id.toString();
    // Create an enrollment resource object for permission checking
    const enrollmentResource = subject('Enrollment', { userId });
    
    // Check permission using ability.can() with the actual enrollment resource
    if (!ability.can(EnrollmentActions.View, enrollmentResource)) {
      throw new ForbiddenError('You do not have permission to view these enrollments');
    }
    
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
  @Authorized()
  @Get('/:userId/enrollments/courses/:courseId/versions/:versionId')
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
    @Ability(getEnrollmentAbility) {ability}
  ): Promise<EnrolledUserResponse> {
    const { userId, courseId, versionId } = params;
    
    // Create an enrollment resource object for permission checking
    const enrollmentResource = subject('Enrollment', { 
      userId, 
      courseId, 
      versionId 
    });
    
    // Check permission using ability.can() with the actual enrollment resource
    if (!ability.can(EnrollmentActions.ViewAll, enrollmentResource)) {
      throw new ForbiddenError('You do not have permission to view this enrollment');
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
    description: 'Retrieves a paginated list of all users enrolled in a specific course version.',
  })
  @Authorized()
  @Get('/enrollments/courses/:courseId/versions/:versionId')
  @HttpCode(200)
  @ResponseSchema(CourseVersionEnrollmentResponse, {
    description: 'Paginated list of enrollments for the course version',
  })
  @ResponseSchema(EnrollmentNotFoundErrorResponse, {
    description: 'No enrollments found for the course version',
    statusCode: 404,
  })
  @ResponseSchema(BadRequestError, {
    description: 'Invalid page or limit parameters',
    statusCode: 400,
  })
  async getCourseVersionEnrollments(
    @Param('courseId') courseId: string,
    @Param('versionId') versionId: string,
    @QueryParam('page') page = 1,
    @QueryParam('limit') limit = 10,
    @Ability(getEnrollmentAbility) {ability}
  ): Promise<CourseVersionEnrollmentResponse> {
    // Create an enrollment resource object for permission checking
    const enrollmentResource = subject('Enrollment', { 
      courseId, 
      versionId 
    });
    
    // Check permission using ability.can() with the actual enrollment resource
    if (!ability.can(EnrollmentActions.ViewAll, enrollmentResource)) {
      throw new ForbiddenError('You do not have permission to view enrollments for this course');
    }
    
    // Convert page and limit to integers
    page = parseInt(page as unknown as string, 10);
    limit = parseInt(limit as unknown as string, 10);

    if (page < 1 || limit < 1) {
      throw new BadRequestError('Page and limit must be positive integers.');
    }
    const skip = (page - 1) * limit;

    const enrollments = await this.enrollmentService.getCourseVersionEnrollments(
      courseId,
      versionId,
      skip,
      limit,
    );

    if (!enrollments || enrollments.length === 0) {
      throw new NotFoundError('No enrollments found for the given course version.');
    }

    return {
      enrollments: enrollments
    };
  }
}