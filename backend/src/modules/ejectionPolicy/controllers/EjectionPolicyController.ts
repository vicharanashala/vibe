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
    // Only admins can create platform-wide policies
    if (body.scope === 'platform' && user.roles !== 'admin') {
      throw new ForbiddenError(
        'Only administrators can create platform-wide policies',
      );
    }

    // For course-specific policies, check permissions
    if (body.scope === 'course') {
      if (!body.courseId) {
        throw new ForbiddenError(
          'courseId is required for course-specific policies',
        );
      }

      const policyContext = {courseId: body.courseId};
      const policySubject = subject('EjectionPolicy', policyContext);

      if (!ability.can(EjectionPolicyActions.Create, policySubject)) {
        throw new ForbiddenError(
          'You do not have permission to create policies for this course',
        );
      }
    }

    const policy = await this.policyService.createPolicy(
      body,
      user._id.toString(),
    );
    setAuditTrail(req, {
      category: AuditCategory.EJECTION_POLICY,
      action: AuditAction.EJECTION_POLICY_CREATE,
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName ?? ''}`,
        email: user.email,
        role: user.roles,
      },
      context: {
        policyId: ObjectId.createFromHexString(policy._id.toString()),
        courseId: body.courseId
          ? ObjectId.createFromHexString(body.courseId)
          : undefined,
      },
      changes: {
        after: policy,
      },
      outcome: {
        status: OutComeStatus.SUCCESS,
      },
    });
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
      'Retrieves ejection policies with optional filters. Admins see all policies. Managers/Instructors must specify courseId.',
  })
  async getPolicies(
    @QueryParams() query: GetPoliciesQuery,
    @Ability(getEjectionPolicyAbility) {ability, user},
  ): Promise<PoliciesListResponse> {
    let policies;

    if (user.roles === 'admin') {
      //  Admins can see all policies
      const filters: any = {
        scope: query.scope,
        isActive: query.active,
      };

      if (query.courseId) {
        filters.courseId = query.courseId;
      }

      policies = await this.policyService.getPolicies(filters);
    } else {
      const filters: any = {
        scope: query.scope,
        isActive: query.active,
      };

      // Platform policies are visible to everyone
      if (query.scope === 'platform') {
        policies = await this.policyService.getPolicies(filters);
      } else {
        // Course policies require courseId
        if (!query.courseId) {
          throw new ForbiddenError(
            'courseId is required for course-specific policies.',
          );
        }

        const policyContext = {courseId: query.courseId};
        const policySubject = subject('EjectionPolicy', policyContext);

        if (!ability.can(EjectionPolicyActions.View, policySubject)) {
          throw new ForbiddenError(
            'You do not have permission to view policies for this course',
          );
        }

        filters.courseId = query.courseId;

        policies = await this.policyService.getPolicies(filters);
      }
    }

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

    // Admins can view any policy
    if (user.roles !== 'admin') {
      // For course-specific policies, check permissions
      if (policy.scope === 'course' && policy.courseId) {
        const policyContext = {courseId: policy.courseId.toString()};
        const policySubject = subject('EjectionPolicy', policyContext);

        if (!ability.can(EjectionPolicyActions.View, policySubject)) {
          throw new ForbiddenError(
            'You do not have permission to view this policy',
          );
        }
      } else if (policy.scope === 'platform') {
        // Everyone can view platform-wide policies
        return plainToClass(EjectionPolicyResponse, policy, {
          enableImplicitConversion: true,
        });
      }
    }

    return plainToClass(EjectionPolicyResponse, policy, {
      enableImplicitConversion: true,
    });
  }

  @Authorized()
  @Get('/courses/:courseId/active')
  @HttpCode(200)
  @ResponseSchema(PoliciesListResponse, {
    description: 'Active policies for the course',
    statusCode: 200,
  })
  @OpenAPI({
    summary: 'Get active policies for a course',
    description:
      'Retrieves all active ejection policies for a specific course (includes platform-wide and course-specific policies).',
  })
  async getActivePoliciesForCourse(
    @Param('courseId') courseId: string,
    @Ability(getEjectionPolicyAbility) {ability, user},
  ): Promise<PoliciesListResponse> {
    // Check if user has access to this course
    if (user.roles !== 'admin') {
      const courseContext = {courseId};
      const policySubject = subject('EjectionPolicy', courseContext);

      if (!ability.can(EjectionPolicyActions.View, policySubject)) {
        throw new ForbiddenError(
          'You do not have permission to view policies for this course',
        );
      }
    }

    const policies =
      await this.policyService.getActivePoliciesForCourse(courseId);

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
    const existingPolicy = await this.policyService.getPolicyById(policyId);

    // Only admins can update platform-wide policies
    if (existingPolicy.scope === 'platform' && user.roles !== 'admin') {
      throw new ForbiddenError(
        'Only administrators can update platform-wide policies',
      );
    }

    // For course-specific policies, check permissions
    if (existingPolicy.scope === 'course' && existingPolicy.courseId) {
      const policyContext = {courseId: existingPolicy.courseId.toString()};
      const policySubject = subject('EjectionPolicy', policyContext);

      if (!ability.can(EjectionPolicyActions.Modify, policySubject)) {
        throw new ForbiddenError(
          'You do not have permission to update this policy',
        );
      }
    }

    const updatedPolicy = await this.policyService.updatePolicy(policyId, body);
    setAuditTrail(req, {
      category: AuditCategory.EJECTION_POLICY,
      action: AuditAction.EJECTION_POLICY_UPDATE,
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName ?? ''}`,
        email: user.email,
        role: user.roles,
      },
      context: {
        policyId: ObjectId.createFromHexString(policyId),
      },
      changes: {
        before: existingPolicy,
        after: updatedPolicy,
      },
      outcome: {
        status: OutComeStatus.SUCCESS,
      },
    });

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
    const existingPolicy = await this.policyService.getPolicyById(policyId);

    // Check permissions (same as update)
    if (existingPolicy.scope === 'platform' && user.roles !== 'admin') {
      throw new ForbiddenError(
        'Only administrators can modify platform-wide policies',
      );
    }

    if (existingPolicy.scope === 'course' && existingPolicy.courseId) {
      const policyContext = {courseId: existingPolicy.courseId.toString()};
      const policySubject = subject('EjectionPolicy', policyContext);

      if (!ability.can(EjectionPolicyActions.Modify, policySubject)) {
        throw new ForbiddenError(
          'You do not have permission to modify this policy',
        );
      }
    }

    const updatedPolicy = await this.policyService.togglePolicyStatus(policyId);
    setAuditTrail(req, {
      category: AuditCategory.EJECTION_POLICY,
      action: AuditAction.EJECTION_POLICY_TOGGLE,
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName ?? ''}`,
        email: user.email,
        role: user.roles,
      },
      context: {
        policyId: ObjectId.createFromHexString(policyId),
      },
      outcome: {
        status: OutComeStatus.SUCCESS,
      },
    });

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
    const existingPolicy = await this.policyService.getPolicyById(policyId);

    // Only admins can delete platform-wide policies
    if (existingPolicy.scope === 'platform' && user.roles !== 'admin') {
      throw new ForbiddenError(
        'Only administrators can delete platform-wide policies',
      );
    }

    // For course-specific policies, check permissions
    if (existingPolicy.scope === 'course' && existingPolicy.courseId) {
      const policyContext = {courseId: existingPolicy.courseId.toString()};
      const policySubject = subject('EjectionPolicy', policyContext);

      if (!ability.can(EjectionPolicyActions.Delete, policySubject)) {
        throw new ForbiddenError(
          'You do not have permission to delete this policy',
        );
      }
    }

    await this.policyService.deletePolicy(policyId);
    setAuditTrail(req, {
      category: AuditCategory.EJECTION_POLICY,
      action: AuditAction.EJECTION_POLICY_DELETE,
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName ?? ''}`,
        email: user.email,
        role: user.roles,
      },
      context: {
        policyId: ObjectId.createFromHexString(policyId),
      },
      outcome: {
        status: OutComeStatus.SUCCESS,
      },
    });
    return {
      message: 'Policy deleted successfully',
      policyId: policyId,
    };
  }
}
