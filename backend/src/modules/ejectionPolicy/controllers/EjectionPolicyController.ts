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
    @Ability(getEjectionPolicyAbility) {ability, user, authenticatedUser},
  ): Promise<EjectionPolicyResponse> {
    // Only admins can create platform-wide policies
    if (body.scope === 'platform' && authenticatedUser.globalRole !== 'admin') {
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
      'Retrieves ejection policies with optional filters. Admins see all policies. Managers/Instructors see policies for their courses.',
  })
  async getPolicies(
    @QueryParams() query: GetPoliciesQuery,
    @Ability(getEjectionPolicyAbility) {ability, user, authenticatedUser},
  ): Promise<PoliciesListResponse> {
    let policies;
    // ✅ ADD DEBUGGING
    console.log('🔍 getPolicies Debug:');
    console.log(
      '  authenticatedUser.globalRole:',
      authenticatedUser.globalRole,
    );
    console.log('  user.roles:', user.roles);
    console.log('  query:', query);

    if (authenticatedUser.globalRole === 'admin') {
      console.log('  ✅ Admin branch reached');
      // Admins can see all policies
      const filters: any = {
        scope: query.scope,
        isActive: query.active,
      };
      console.log('  filters being sent to service:', filters);
      if (query.courseId) {
        filters.courseId = query.courseId;
      }
      policies = await this.policyService.getPolicies(filters);
      console.log('  policies returned from service:', policies.length);
    } else {
      // Non-admins: filter by courses they have access to
      console.log('  ❌ Non-admin branch reached');
      if (query.courseId) {
        // Check if they can view this course's policies
        const policyContext = {courseId: query.courseId};
        const policySubject = subject('EjectionPolicy', policyContext);

        if (!ability.can(EjectionPolicyActions.View, policySubject)) {
          throw new ForbiddenError(
            'You do not have permission to view policies for this course',
          );
        }

        policies = await this.policyService.getPolicies({
          scope: query.scope,
          courseId: query.courseId,
          isActive: query.active,
        });
      } else {
        // Get policies for all courses they have access to
        const accessibleCourseIds = (authenticatedUser.enrollments || [])
          .filter(e => ['MANAGER', 'INSTRUCTOR', 'TA'].includes(e.role))
          .map(e => e.courseId);

        if (accessibleCourseIds.length === 0) {
          return {
            policies: [],
            total: 0,
          };
        }

        // Get policies for their first accessible course (simplified)
        // In production, you'd enhance the service to support multiple courseIds
        policies = await this.policyService.getPolicies({
          scope: query.scope,
          courseId: accessibleCourseIds[0],
          isActive: query.active,
        });
      }
    }

    const responsePolicies = policies.map(p =>
      plainToClass(EjectionPolicyResponse, p, {
        enableImplicitConversion: true,
      }),
    );
    console.log('Final response policies:', responsePolicies.length);

    return {
      policies: responsePolicies,
      total: responsePolicies.length,
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
    @Ability(getEjectionPolicyAbility) {ability, user, authenticatedUser},
  ): Promise<EjectionPolicyResponse> {
    const policy = await this.policyService.getPolicyById(policyId);

    // Admins can view any policy
    if (authenticatedUser.globalRole !== 'admin') {
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
        // Only admins can view platform-wide policies
        throw new ForbiddenError(
          'You do not have permission to view platform-wide policies',
        );
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
    @Ability(getEjectionPolicyAbility) {ability, user, authenticatedUser},
  ): Promise<PoliciesListResponse> {
    // Check if user has access to this course
    if (authenticatedUser.globalRole !== 'admin') {
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
    };
  }

  @Authorized()
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
    @Ability(getEjectionPolicyAbility) {ability, user, authenticatedUser},
  ): Promise<EjectionPolicyResponse> {
    const existingPolicy = await this.policyService.getPolicyById(policyId);

    // Only admins can update platform-wide policies
    if (
      existingPolicy.scope === 'platform' &&
      authenticatedUser.globalRole !== 'admin'
    ) {
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

    return plainToClass(EjectionPolicyResponse, updatedPolicy, {
      enableImplicitConversion: true,
    });
  }

  @Authorized()
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
    @Ability(getEjectionPolicyAbility) {ability, user, authenticatedUser},
  ): Promise<EjectionPolicyResponse> {
    const existingPolicy = await this.policyService.getPolicyById(policyId);

    // Check permissions (same as update)
    if (
      existingPolicy.scope === 'platform' &&
      authenticatedUser.globalRole !== 'admin'
    ) {
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

    return plainToClass(EjectionPolicyResponse, updatedPolicy, {
      enableImplicitConversion: true,
    });
  }

  @Authorized()
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
    @Ability(getEjectionPolicyAbility) {ability, user, authenticatedUser},
  ): Promise<DeletePolicyResponse> {
    const existingPolicy = await this.policyService.getPolicyById(policyId);

    // Only admins can delete platform-wide policies
    if (
      existingPolicy.scope === 'platform' &&
      authenticatedUser.globalRole !== 'admin'
    ) {
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
    return {
      message: 'Policy deleted successfully',
      policyId: policyId,
    };
  }
}
