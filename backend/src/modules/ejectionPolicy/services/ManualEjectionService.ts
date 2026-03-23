import 'reflect-metadata';
import {injectable, inject} from 'inversify';
import {ForbiddenError} from 'routing-controllers';
import {EJECTION_POLICY_TYPES} from '../types.js';
import {EjectionPolicyService} from './EjectionPolicyService.js';
import {USERS_TYPES} from '#root/modules/users/types.js';
import {EnrollmentService} from '#root/modules/users/services/EnrollmentService.js';
import {NotificationService} from '#root/modules/notifications/services/NotificationService.js';

export interface ManualEjectionResult {
  enrollmentId: string;
  userId: string;
  courseId: string;
  courseVersionId: string;
  reason: string;
  ejectedAt: Date;
}

@injectable()
export class ManualEjectionService {
  constructor(
    @inject(EJECTION_POLICY_TYPES.EjectionPolicyService)
    private readonly policyService: EjectionPolicyService,
    @inject(EJECTION_POLICY_TYPES.NotificationService)
    private readonly notificationService: NotificationService,
    @inject(USERS_TYPES.EnrollmentService)
    private readonly enrollmentService: EnrollmentService,
  ) {}

  async ejectLearner(
    userId: string,
    courseId: string,
    courseVersionId: string,
    reason: string,
    ejectedBy: string,
    cohortId?: string,
    policyId?: string,
  ): Promise<ManualEjectionResult> {
    // If a policyId is provided, validate it exists and is active
    if (policyId) {
      const policy = await this.policyService.getPolicyById(policyId);
      if (!policy.isActive) {
        throw new ForbiddenError(
          'The specified policy is not active and cannot be used for ejection',
        );
      }
    }

    const {enrollment} = await this.enrollmentService.ejectUser(
      userId,
      courseId,
      courseVersionId,
      reason,
      ejectedBy,
      cohortId,
      policyId,
    );

    await this.notificationService.notifyEjection(
      userId,
      courseId,
      courseVersionId,
      reason,
      cohortId,
    );

    const lastEntry = (enrollment.ejectionHistory as any[]).at(-1);

    return {
      enrollmentId: enrollment._id.toString(),
      userId,
      courseId,
      courseVersionId,
      reason,
      ejectedAt: lastEntry.ejectedAt,
    };
  }

  async bulkEjectLearners(
    userIds: string[],
    courseId: string,
    courseVersionId: string,
    reason: string,
    ejectedBy: string,
    cohortId?: string,
    policyId?: string,
  ): Promise<{successCount: number; failureCount: number; errors: string[]}> {
    const results = await Promise.allSettled(
      userIds.map(userId =>
        this.ejectLearner(
          userId,
          courseId,
          courseVersionId,
          reason,
          ejectedBy,
          cohortId,
          policyId,
        ),
      ),
    );

    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        successCount++;
      } else {
        failureCount++;
        errors.push(
          `User ${userIds[idx]}: ${result.reason?.message ?? 'Unknown error'}`,
        );
      }
    });

    return {successCount, failureCount, errors};
  }
}
