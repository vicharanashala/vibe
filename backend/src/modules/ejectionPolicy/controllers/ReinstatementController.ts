import 'reflect-metadata';
import {
  JsonController,
  Post,
  HttpCode,
  Params,
  Body,
  Authorized,
  ForbiddenError,
  UseInterceptor,
  Req,
} from 'routing-controllers';
import {injectable, inject} from 'inversify';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {plainToClass} from 'class-transformer';
import {ObjectId} from 'mongodb';
import {AuditTrailsHandler} from '#root/shared/middleware/auditTrails.js';
import {setAuditTrail} from '#root/utils/setAuditTrail.js';
import {
  AuditAction,
  AuditCategory,
  OutComeStatus,
} from '#root/modules/auditTrails/interfaces/IAuditTrails.js';
import {Ability} from '#root/shared/functions/AbilityDecorator.js';
import {BadRequestErrorResponse} from '#shared/middleware/errorHandler.js';
import {EJECTION_POLICY_TYPES} from '../types.js';
import {ReinstatementService} from '../services/ReinstatementService.js';
import {getEjectionPolicyAbility} from '../abilities/ejectionPolicyAbilities.js';
import {
  ReinstatementParams,
  ReinstatementBody,
  ReinstatementResponse,
  BulkReinstatementResponse,
  BulkReinstatementBody,
} from '../classes/validators/ReinstatementValidators.js';

@OpenAPI({tags: ['Reinstatement']})
@JsonController('/reinstatements', {transformResponse: true})
@injectable()
export class ReinstatementController {
  constructor(
    @inject(EJECTION_POLICY_TYPES.ReinstatementService)
    private readonly reinstatementService: ReinstatementService,
  ) {}

  /**
   * POST /reinstatements/courses/:courseId/versions/:courseVersionId/users/:userId
   * Reinstate an ejected learner. Admin only.
   */
  @Authorized()
  @Post('/courses/:courseId/versions/:courseVersionId/users/:userId')
  @UseInterceptor(AuditTrailsHandler)
  @HttpCode(200)
  @ResponseSchema(ReinstatementResponse, {
    description: 'Learner reinstated successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Learner not ejected or already active',
    statusCode: 400,
  })
  @OpenAPI({
    summary: 'Reinstate an ejected learner',
    description:
      'Reinstates a learner who was previously ejected. ' +
      'Restores their enrollment to ACTIVE status. ' +
      'Progress and watchtime are untouched. ' +
      'Admin only.',
  })
  async reinstateLearner(
    @Params() params: ReinstatementParams,
    @Body() body: ReinstatementBody,
    @Ability(getEjectionPolicyAbility) {user},
    @Req() req: Request,
  ): Promise<ReinstatementResponse> {
    if (user.roles !== 'admin') {
      throw new ForbiddenError(
        'Only administrators can reinstate ejected learners',
      );
    }

    const {courseId, courseVersionId, userId} = params;

    const result = await this.reinstatementService.reinstateLearner(
      userId,
      courseId,
      courseVersionId,
      user._id.toString(),
      body.cohortId,
    );

    setAuditTrail(req, {
      category: AuditCategory.ENROLLMENT,
      action: AuditAction.ENROLLMENT_ADD,
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName ?? ''}`,
        email: user.email,
        role: user.roles,
      },
      context: {
        courseId: ObjectId.createFromHexString(courseId),
        courseVersionId: ObjectId.createFromHexString(courseVersionId),
        userId: ObjectId.createFromHexString(userId),
      },
      changes: {
        after: {
          reinstatedAt: result.reinstatedAt,
          reinstatedBy: user._id.toString(),
        },
      },
      outcome: {
        status: OutComeStatus.SUCCESS,
      },
    });

    return plainToClass(
      ReinstatementResponse,
      {
        message: 'Learner reinstated successfully',
        enrollmentId: result.enrollmentId,
        userId: result.userId,
        courseId: result.courseId,
        courseVersionId: result.courseVersionId,
        reinstatedAt: result.reinstatedAt,
      },
      {enableImplicitConversion: true},
    );
  }

  @Authorized()
  @Post('/bulk')
  @UseInterceptor(AuditTrailsHandler)
  @HttpCode(200)
  @ResponseSchema(BulkReinstatementResponse, {
    description: 'Bulk reinstatement result',
    statusCode: 200,
  })
  @OpenAPI({
    summary: 'Bulk reinstate learners',
    description: 'Reinstates multiple ejected learners at once. Admin only.',
  })
  async bulkReinstateLearners(
    @Body() body: BulkReinstatementBody,
    @Ability(getEjectionPolicyAbility) {user},
    @Req() req: Request,
  ): Promise<BulkReinstatementResponse> {
    if (user.roles !== 'admin') {
      throw new ForbiddenError(
        'Only administrators can bulk reinstate learners',
      );
    }

    const result = await this.reinstatementService.bulkReinstateLearners(
      body.userIds,
      body.courseId,
      body.courseVersionId,
      user._id.toString(),
      body.cohortId,
    );

    setAuditTrail(req, {
      category: AuditCategory.ENROLLMENT,
      action: AuditAction.ENROLLMENT_ADD,
      actor: {
        id: ObjectId.createFromHexString(user._id.toString()),
        name: `${user.firstName} ${user.lastName ?? ''}`,
        email: user.email,
        role: user.roles,
      },
      context: {
        courseId: ObjectId.createFromHexString(body.courseId),
        courseVersionId: ObjectId.createFromHexString(body.courseVersionId),
      },
      changes: {
        after: {reinstatedCount: result.successCount},
      },
      outcome: {
        status:
          result.failureCount === 0
            ? OutComeStatus.SUCCESS
            : result.successCount === 0
              ? OutComeStatus.FAILED
              : OutComeStatus.PARTIAL,
      },
    });

    return plainToClass(BulkReinstatementResponse, result, {
      enableImplicitConversion: true,
    });
  }
}
