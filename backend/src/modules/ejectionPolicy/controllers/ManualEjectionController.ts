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
  QueryParams,
  Get,
  QueryParam,
  Res,
} from 'routing-controllers';
import {Response, Request} from 'express';
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
  BulkEjectionResponse,
  BulkEjectionBody,
} from '../classes/validators/ManualEjectionValidators.js';
import {
  EjectionHistoryQuery,
  EjectionHistoryResponse,
} from '../classes/validators/EjectionHistoryValidators.js';
import {USERS_TYPES} from '#root/modules/users/types.js';
import {EnrollmentService} from '#root/modules/users/services/EnrollmentService.js';
import {
  EjectionStudentResponse,
  EjectionStudentsListResponse,
  EjectionStudentsParams,
  EjectionStudentsQuery,
  EjectionPolicyResponse,
} from '../classes/index.js';
import {EjectionPolicyService} from '../services/EjectionPolicyService.js';

@OpenAPI({tags: ['Manual Ejection']})
@JsonController('/ejections', {transformResponse: true})
@injectable()
export class ManualEjectionController {
  constructor(
    @inject(EJECTION_POLICY_TYPES.ManualEjectionService)
    private readonly manualEjectionService: ManualEjectionService,
    @inject(USERS_TYPES.EnrollmentService)
    private readonly enrollmentService: EnrollmentService,
    @inject(EJECTION_POLICY_TYPES.EjectionPolicyService)
    private readonly policyService: EjectionPolicyService,
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

  @Authorized()
  @Get(
    '/courses/:courseId/versions/:courseVersionId/cohorts/:cohortId/students',
  )
  @HttpCode(200)
  @ResponseSchema(EjectionStudentsListResponse, {
    description: 'Students in cohort with ejection metadata',
    statusCode: 200,
  })
  @OpenAPI({
    summary: 'Get students for ejection management',
    description:
      'Returns all students in a cohort with ejection status, history, and last active date. ' +
      'Admin only. Designed for the manual ejection UI and future auto-ejection engine.',
  })
  async getStudentsForEjection(
    @Params() params: EjectionStudentsParams,
    @QueryParams() query: EjectionStudentsQuery,
    @Ability(getEjectionPolicyAbility) {user},
  ): Promise<EjectionStudentsListResponse> {
    if (user.roles !== 'admin') {
      throw new ForbiddenError(
        'Only administrators can access ejection student data',
      );
    }

    const {courseId, courseVersionId, cohortId} = params;

    const {students, totalDocuments, totalPages} =
      await this.enrollmentService.getStudentsForEjectionPage(
        courseId,
        courseVersionId,
        cohortId,
        query.page,
        query.limit,
        query.search ?? '',
        query.statusFilter,
      );

    const activePolicies = await this.policyService.getActivePoliciesForCourse(
      courseId,
      courseVersionId,
      cohortId,
    );

    const now = new Date();

    const mapped: EjectionStudentResponse[] = students.map(s => {
      const lastActiveAt = s.lastActiveAt ? new Date(s.lastActiveAt) : null;
      const daysSinceLastActive = lastActiveAt
        ? Math.floor(
            (now.getTime() - lastActiveAt.getTime()) / (1000 * 60 * 60 * 24),
          )
        : null;

      // ejectionStatus logic — T-05 will extend this
      let ejectionStatus: 'active' | 'ejected' | 'warning' = 'active';
      if (s.isEjected) {
        ejectionStatus = 'ejected';
      } else if (daysSinceLastActive !== null && daysSinceLastActive >= 20) {
        // Soft warning threshold — T-05 will make this policy-driven
        ejectionStatus = 'warning';
      }

      return plainToClass(
        EjectionStudentResponse,
        {
          enrollmentId: s._id?.toString(),
          userId: s.userId?.toString(),
          name:
            `${s.user?.firstName ?? ''} ${s.user?.lastName ?? ''}`.trim() ||
            'Unknown',
          email: s.user?.email ?? '',
          enrollmentDate: s.enrollmentDate,
          percentCompleted: s.percentCompleted ?? 0,
          isEjected: s.isEjected ?? false,
          ejectionStatus,
          lastActiveAt: lastActiveAt ?? undefined,
          daysSinceLastActive: daysSinceLastActive ?? undefined,
          ejectionHistory: s.ejectionHistory ?? [],
        },
        {enableImplicitConversion: true},
      );
    });

    return {
      students: mapped,
      policies: activePolicies.map(p =>
        plainToClass(EjectionPolicyResponse, p, {
          enableImplicitConversion: true,
        }),
      ),
      totalDocuments,
      totalPages,
      currentPage: query.page,
    };
  }

  @Authorized()
  @Post('/bulk')
  @UseInterceptor(AuditTrailsHandler)
  @HttpCode(200)
  @ResponseSchema(BulkEjectionResponse, {
    description: 'Bulk ejection result',
    statusCode: 200,
  })
  @OpenAPI({
    summary: 'Bulk eject learners',
    description:
      'Ejects multiple learners at once with a shared reason. Admin only.',
  })
  async bulkEjectLearners(
    @Body() body: BulkEjectionBody,
    @Ability(getEjectionPolicyAbility) {user},
    @Req() req: Request,
  ): Promise<BulkEjectionResponse> {
    if (user.roles !== 'admin') {
      throw new ForbiddenError('Only administrators can bulk eject learners');
    }

    const result = await this.manualEjectionService.bulkEjectLearners(
      body.userIds,
      body.courseId,
      body.courseVersionId,
      body.reason,
      user._id.toString(),
      body.cohortId,
      body.policyId,
    );

    setAuditTrail(req, {
      category: AuditCategory.ENROLLMENT,
      action: AuditAction.BULK_ENROLLMENT_REMOVE,
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
        after: {
          ejectedCount: result.successCount,
          reason: body.reason,
        },
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

    return plainToClass(BulkEjectionResponse, result, {
      enableImplicitConversion: true,
    });
  }


  @Get('/history')
  @Authorized()
  @HttpCode(200)
  @ResponseSchema(EjectionHistoryResponse)
  async getEjectionHistory(
    @QueryParams() query: EjectionHistoryQuery,
    @Ability(getEjectionPolicyAbility) {user},
  ): Promise<EjectionHistoryResponse> {
    if (user.roles !== 'admin') {
      throw new ForbiddenError('Only administrators can access ejection history');
    }
    const {courseId, courseVersionId} = query;
    return await this.enrollmentService.getGlobalEjectionHistory(
      courseId,
      courseVersionId,
      query,
    );
  }

  @Get('/history/export')
  @Authorized()
  async exportEjectionHistory(
    @QueryParams() query: EjectionHistoryQuery,
    @Res() res: Response,
    @Ability(getEjectionPolicyAbility) {user},
  ): Promise<void> {
    if (user.roles !== 'admin') {
      throw new ForbiddenError('Only administrators can access ejection history');
    }
    const {courseId, courseVersionId} = query;
    const csvContent = await this.enrollmentService.exportEjectionHistoryCSV(
      courseId,
      courseVersionId,
      query,
    );

    res.removeHeader('Content-Type');
    res.status(200);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="ejection_history.csv"',
    );
    res.setHeader('Cache-Control', 'no-cache');
    res.write(csvContent);
    res.end();
  }
}
