import 'reflect-metadata';
import {
  JsonController,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  QueryParams,
  Authorized,
  CurrentUser,
  HttpCode,
  ForbiddenError,
  UseInterceptor,
  Req,
} from 'routing-controllers';
import {injectable, inject} from 'inversify';
import {Ability} from '#root/shared/functions/AbilityDecorator.js';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {EjectionPolicyService} from '../services/EjectionPolicyService.js';
import {
  CreateEjectionPolicyBody,
  UpdateEjectionPolicyBody,
  PolicyIdParams,
  CourseIdParams,
  CourseVersionParams,
  GetPoliciesQuery,
  EjectionPolicyResponse,
  PoliciesListResponse,
  DeletePolicyResponse,
} from '../classes/validators/EjectionPolicyValidators.js';
import {BadRequestErrorResponse} from '#shared/middleware/errorHandler.js';
import {EJECTION_POLICY_TYPES} from '../types.js';
import {
  EjectionPolicyActions,
  getEjectionPolicyAbility,
} from '../abilities/ejectionPolicyAbilities.js';
import {subject} from '@casl/ability';
import {plainToClass} from 'class-transformer';
import {AuditTrailsHandler} from '#root/shared/middleware/auditTrails.js';
import {setAuditTrail} from '#root/utils/setAuditTrail.js';
import {
  AuditAction,
  AuditCategory,
  OutComeStatus,
} from '#root/modules/auditTrails/interfaces/IAuditTrails.js';
import {ObjectId} from 'mongodb';
import {NotificationService} from '#root/modules/notifications/services/NotificationService.js';
import {EnrollmentService} from '#root/modules/users/services/EnrollmentService.js';
import {USERS_TYPES} from '#root/modules/users/types.js';

/**
 * Controller for managing ejection policies
 *
 * @category EjectionPolicy/Controllers
 */
@OpenAPI({
  tags: ['Ejection Policies'],
})
@JsonController('/ejection-policies', {transformResponse: true})
@injectable()
export class EjectionPolicyController {
  constructor(
    @inject(EJECTION_POLICY_TYPES.EjectionPolicyService)
    private readonly policyService: EjectionPolicyService,
    @inject(EJECTION_POLICY_TYPES.NotificationService)
    private readonly notificationService: NotificationService,
    @inject(USERS_TYPES.EnrollmentService)
    private readonly enrollmentService: EnrollmentService,
  ) {}

  @Authorized()
  @Post('/')
  @UseInterceptor(AuditTrailsHandler)
  @HttpCode(201)
  @ResponseSchema(EjectionPolicyResponse, {
    description: 'Ejection policy created successfully',
    statusCode: 201,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid input data',
    statusCode: 400,
  })
  @OpenAPI({
    summary: 'Create a new ejection policy',
    description:
      'Creates a new ejection policy with specified triggers and actions. Only admins can create platform-wide policies. Managers can create course-specific policies.',
  })
  async createPolicy(
    @Body() body: CreateEjectionPolicyBody,
    @Ability(getEjectionPolicyAbility) {ability, user},
    @Req() req: Request,
  ): Promise<EjectionPolicyResponse> {
    if (user.roles !== 'admin') {
      throw new ForbiddenError(
        'Only administrators can create ejection policies',
      );
    }
    console.log('body=================================', body);

    if (!body.courseId) throw new ForbiddenError('courseId is required');
    if (!body.courseVersionId)
      throw new ForbiddenError('courseVersionId is required');
    if (!body.cohortId) throw new ForbiddenError('cohortId is required!!!');

    const policy = await this.policyService.createPolicy(
      body,
      user._id.toString(),
    );
    await this.notificationService.notifyPolicyChange(
      body.courseId,
      body.courseVersionId,
      body.cohortId,
      body.name,
      true,
      policy._id?.toString(),
    );
    await this.enrollmentService.markPolicyReacknowledgementRequired(
      policy.courseId.toString(),
      policy.courseVersionId.toString(),
      policy.cohortId.toString(),
    );
    // audit trail stays the same
    return plainToClass(EjectionPolicyResponse, policy, {
      enableImplicitConversion: true,
    });
  }

  @Authorized()
  @Get('/')
  @HttpCode(200)
  @ResponseSchema(PoliciesListResponse, {
    description: 'List of ejection policies',
    statusCode: 200,
  })
  @OpenAPI({
    summary: 'Get all ejection policies',
    description:
      'Retrieves ejection policies with optional filters. Admins see all policies. Managers/Instructors must specify courseId and courseVersionId.',
  })
  async getPolicies(
    @QueryParams() query: GetPoliciesQuery,
    @Ability(getEjectionPolicyAbility) {ability, user},
  ): Promise<PoliciesListResponse> {
    if (!query.courseId) {
      throw new ForbiddenError('courseId is required');
    }
    if (!query.courseVersionId) {
      throw new ForbiddenError('courseVersionId is required');
    }

    const policySubject = subject('EjectionPolicy', {
      courseId: query.courseId,
      courseVersionId: query.courseVersionId,
    });

    if (
      user.roles !== 'admin' &&
      !ability.can(EjectionPolicyActions.View, policySubject)
    ) {
      throw new ForbiddenError(
        'You do not have permission to view policies for this course',
      );
    }

    const policies = await this.policyService.getPolicies({
      courseId: query.courseId,
      courseVersionId: query.courseVersionId,
      cohortId: query.cohortId,
      isActive: query.active,
    });

    const responsePolicies = policies.map(p =>
      plainToClass(EjectionPolicyResponse, p, {
        enableImplicitConversion: true,
      }),
    );

    return {
      policies: responsePolicies,
      total: responsePolicies.length,
      isAdmin: user.roles === 'admin',
    };
  }

  @Authorized()
  @Get('/:policyId')
  @HttpCode(200)
  @ResponseSchema(EjectionPolicyResponse, {
    description: 'Ejection policy details',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Policy not found',
    statusCode: 404,
  })
  @OpenAPI({
    summary: 'Get a specific ejection policy',
    description: 'Retrieves details of a specific ejection policy by ID.',
  })
  async getPolicy(
    @Param('policyId') policyId: string,
    @Ability(getEjectionPolicyAbility) {ability, user},
  ): Promise<EjectionPolicyResponse> {
    const policy = await this.policyService.getPolicyById(policyId);

    if (user.roles !== 'admin') {
      if (policy.courseId) {
        const policySubject = subject('EjectionPolicy', {
          courseId: policy.courseId.toString(),
        });
        if (!ability.can(EjectionPolicyActions.View, policySubject)) {
          throw new ForbiddenError(
            'You do not have permission to view this policy',
          );
        }
      }
    }

    return plainToClass(EjectionPolicyResponse, policy, {
      enableImplicitConversion: true,
    });
  }

  @Authorized()
  @Get('/courses/:courseId/versions/:courseVersionId/cohorts/:cohortId/active')
  @HttpCode(200)
  @ResponseSchema(PoliciesListResponse, {
    description: 'Active policies for the course version',
    statusCode: 200,
  })
  @OpenAPI({
    summary: 'Get active policies for a course version',
    description:
      'Retrieves all active ejection policies for a specific course version (includes platform-wide and course-specific policies).',
  })
  async getActivePoliciesForCourse(
    @Param('courseId') courseId: string,
    @Param('courseVersionId') courseVersionId: string,
    @Param('cohortId') cohortId: string,
    @Ability(getEjectionPolicyAbility) {ability, user},
  ): Promise<PoliciesListResponse> {
    // Check if user has access to this course version

    if (user.roles !== 'admin') {
      const courseContext = {courseId, courseVersionId};
      const policySubject = subject('EjectionPolicy', courseContext);

      if (!ability.can(EjectionPolicyActions.View, policySubject)) {
        throw new ForbiddenError(
          'You do not have permission to view policies for this course',
        );
      }
    }

    const policies = await this.policyService.getActivePoliciesForCourse(
      courseId,
      courseVersionId,
      cohortId,
    );

    const responsePolicies = policies.map(p =>
      plainToClass(EjectionPolicyResponse, p, {
        enableImplicitConversion: true,
      }),
    );

    return {
      policies: responsePolicies,
      total: responsePolicies.length,
      isAdmin: user.roles === 'admin',
    };
  }

  @Authorized()
  @UseInterceptor(AuditTrailsHandler)
  @Put('/:policyId')
  @HttpCode(200)
  @ResponseSchema(EjectionPolicyResponse, {
    description: 'Policy updated successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Invalid input data',
    statusCode: 400,
  })
  @OpenAPI({
    summary: 'Update an ejection policy',
    description:
      'Updates an existing ejection policy. Only admins and managers can update policies.',
  })
  async updatePolicy(
    @Param('policyId') policyId: string,
    @Body() body: UpdateEjectionPolicyBody,
    @Ability(getEjectionPolicyAbility) {ability, user},
    @Req() req: Request,
  ): Promise<EjectionPolicyResponse> {
    if (user.roles !== 'admin') {
      throw new ForbiddenError(
        'Only administrators can update ejection policies',
      );
    }
    // remove all scope/platform/course ability checks
    const updatedPolicy = await this.policyService.updatePolicy(policyId, body);

    await this.notificationService.notifyPolicyChange(
      updatedPolicy.courseId.toString(),
      updatedPolicy.courseVersionId.toString(),
      updatedPolicy.cohortId.toString(),
      updatedPolicy.name,
      false,
      policyId,
    );

    await this.enrollmentService.markPolicyReacknowledgementRequired(
      updatedPolicy.courseId.toString(),
      updatedPolicy.courseVersionId.toString(),
      updatedPolicy.cohortId.toString(),
    );
    // audit trail stays the same
    return plainToClass(EjectionPolicyResponse, updatedPolicy, {
      enableImplicitConversion: true,
    });
  }

  @Authorized()
  @UseInterceptor(AuditTrailsHandler)
  @Post('/:policyId/toggle')
  @HttpCode(200)
  @ResponseSchema(EjectionPolicyResponse, {
    description: 'Policy status toggled successfully',
    statusCode: 200,
  })
  @OpenAPI({
    summary: 'Toggle policy active status',
    description: 'Toggles the active/inactive status of an ejection policy.',
  })
  async togglePolicyStatus(
    @Param('policyId') policyId: string,
    @Ability(getEjectionPolicyAbility) {ability, user},
    @Req() req: Request,
  ): Promise<EjectionPolicyResponse> {
    if (user.roles !== 'admin') {
      throw new ForbiddenError(
        'Only administrators can toggle ejection policy status',
      );
    }
    // remove all scope/platform/course ability checks
    const updatedPolicy = await this.policyService.togglePolicyStatus(policyId);
    // audit trail stays the same
    return plainToClass(EjectionPolicyResponse, updatedPolicy, {
      enableImplicitConversion: true,
    });
  }

  @Authorized()
  @UseInterceptor(AuditTrailsHandler)
  @Delete('/:policyId')
  @HttpCode(200)
  @ResponseSchema(DeletePolicyResponse, {
    description: 'Policy deleted successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Policy not found',
    statusCode: 404,
  })
  @OpenAPI({
    summary: 'Delete an ejection policy',
    description:
      'Soft deletes an ejection policy. Only admins and managers can delete policies.',
  })
  async deletePolicy(
    @Param('policyId') policyId: string,
    @Ability(getEjectionPolicyAbility) {ability, user},
    @Req() req: Request,
  ): Promise<DeletePolicyResponse> {
    if (user.roles !== 'admin') {
      throw new ForbiddenError(
        'Only administrators can delete ejection policies',
      );
    }
    // remove all scope/platform/course ability checks
    await this.policyService.deletePolicy(policyId);
    // audit trail stays the same
    return {message: 'Policy deleted successfully', policyId};
  }
}
