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
import {subject} from '@casl/ability';
import {ObjectId} from 'mongodb';
import {Ability} from '#root/shared/functions/AbilityDecorator.js';
import {BadRequestErrorResponse} from '#shared/middleware/errorHandler.js';
import {AuditTrailsHandler} from '#root/shared/middleware/auditTrails.js';
import {setAuditTrail} from '#root/utils/setAuditTrail.js';
import {
  AuditAction,
  AuditCategory,
  OutComeStatus,
} from '#root/modules/auditTrails/interfaces/IAuditTrails.js';
import {EJECTION_POLICY_TYPES} from '../types.js';
import {ManualEjectionService} from '../services/ManualEjectionService.js';
import {
  getEjectionPolicyAbility,
  EjectionPolicyActions,
} from '../abilities/ejectionPolicyAbilities.js';
import {
  ManualEjectionParams,
  ManualEjectionBody,
  ManualEjectionResponse,
} from '../classes/validators/ManualEjectionValidators.js';

@OpenAPI({tags: ['Manual Ejection']})
@JsonController('/ejections', {transformResponse: true})
@injectable()
export class ManualEjectionController {
  constructor(
    @inject(EJECTION_POLICY_TYPES.ManualEjectionService)
    private readonly manualEjectionService: ManualEjectionService,
  ) {}

  @Authorized()
  @Post('/courses/:courseId/versions/:courseVersionId/users/:userId')
  @UseInterceptor(AuditTrailsHandler)
  @HttpCode(200)
  @ResponseSchema(ManualEjectionResponse, {
    description: 'Learner ejected successfully',
    statusCode: 200,
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Learner not enrolled or already ejected',
    statusCode: 400,
  })
  @OpenAPI({
    summary: 'Manually eject a learner',
    description:
      'Ejects a learner from a course version. Soft-deletes progress ' +
      'and watchtime so data is recoverable on reinstatement. ' +
      'Requires a mandatory reason of at least 10 characters. ' +
      'Only admins and managers can perform this action.',
  })
  async ejectLearner(
    @Params() params: ManualEjectionParams,
    @Body() body: ManualEjectionBody,
    @Ability(getEjectionPolicyAbility) {ability, user},
    @Req() req: Request,
  ): Promise<ManualEjectionResponse> {
    const {courseId, courseVersionId, userId} = params;

    if (user.roles !== 'admin') {
      const ejectionSubject = subject('EjectionPolicy', {
        courseId,
        courseVersionId,
      });
      if (!ability.can(EjectionPolicyActions.Modify, ejectionSubject)) {
        throw new ForbiddenError(
          'You do not have permission to eject learners from this course',
        );
      }
    }

    const result = await this.manualEjectionService.ejectLearner(
      userId,
      courseId,
      courseVersionId,
      body.reason,
      user._id.toString(),
      body.cohortId,
      body.policyId,
    );

    setAuditTrail(req, {
      category: AuditCategory.ENROLLMENT,
      action: AuditAction.ENROLLMENT_REMOVE_STUDENT,
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
          ejectionReason: body.reason,
          ejectedAt: result.ejectedAt,
          policyId: body.policyId ?? null,
        },
      },
      outcome: {
        status: OutComeStatus.SUCCESS,
      },
    });

    return plainToClass(
      ManualEjectionResponse,
      {
        message: 'Learner ejected successfully',
        enrollmentId: result.enrollmentId,
        userId: result.userId,
        courseId: result.courseId,
        courseVersionId: result.courseVersionId,
        reason: result.reason,
        ejectedAt: result.ejectedAt,
      },
      {enableImplicitConversion: true},
    );
  }
}
