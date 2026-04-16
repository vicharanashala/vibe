import 'reflect-metadata';
import {injectable, inject} from 'inversify';
import {USERS_TYPES} from '#root/modules/users/types.js';
import {EnrollmentService} from '#root/modules/users/services/EnrollmentService.js';
import {NotificationService} from '#root/modules/notifications/services/NotificationService.js';
import {EJECTION_POLICY_TYPES} from '../types.js';
import {EjectionPolicyService} from './EjectionPolicyService.js';

export interface ReinstatementResult {
  enrollmentId: string;
  userId: string;
  courseId: string;
  courseVersionId: string;
  reinstatedAt: Date;
}

@injectable()
export class ReinstatementService {
  constructor(
    @inject(USERS_TYPES.EnrollmentService)
    private readonly enrollmentService: EnrollmentService,
    @inject(EJECTION_POLICY_TYPES.NotificationService)
    private readonly notificationService: NotificationService,
    @inject(EJECTION_POLICY_TYPES.EjectionPolicyService)
    private readonly policyService: EjectionPolicyService,
  ) {}

  async reinstateLearner(
    userId: string,
    courseId: string,
    courseVersionId: string,
    reinstatedBy: string,
    cohortId?: string,
  ): Promise<ReinstatementResult> {
    // Fetch the ejected enrollment first to get ejectedAt — before any reinstate call
    const ejectedEnrollment =
      await this.enrollmentService.findEjectedEnrollment(
        userId,
        courseId,
        courseVersionId,
        cohortId,
      );

    if (!ejectedEnrollment) {
      throw new Error('No ejected enrollment found');
    }

    const history = (ejectedEnrollment as any).ejectionHistory ?? [];
    const lastEntry = history.at(-1);
    const ejectedAt: Date | undefined = lastEntry?.ejectedAt;

    // Check if policy changed while student was ejected
    let policyChangedDuringEjection = false;
    let changedPolicy: any = null;

    if (ejectedAt && cohortId) {
      changedPolicy = await this.policyService.getPolicyForContext(
        courseId,
        courseVersionId,
        cohortId,
      );

      if (
        changedPolicy &&
        changedPolicy.updatedAt &&
        new Date(changedPolicy.updatedAt) > new Date(ejectedAt)
      ) {
        policyChangedDuringEjection = true;
      }
    }

    if (policyChangedDuringEjection) {
      // PATH A: Policy changed — partial reinstate, course stays hidden
      const {enrollment} = await this.enrollmentService.partialReinstateUser(
        userId,
        courseId,
        courseVersionId,
        reinstatedBy,
        cohortId,
      );

      // Send reinstatement notification
      await this.notificationService.notifyReinstatement(
        userId,
        courseId,
        courseVersionId,
        cohortId,
      );

      // Send policy re-acknowledgement notification
      await this.notificationService.notifyPolicyChangeToUser(
        userId,
        courseId,
        courseVersionId,
        cohortId,
        changedPolicy.name,
        changedPolicy._id?.toString(),
      );

      const updatedHistory = (enrollment as any).ejectionHistory ?? [];
      const updatedLastEntry = updatedHistory.at(-1);

      return {
        enrollmentId: enrollment._id.toString(),
        userId,
        courseId,
        courseVersionId,
        reinstatedAt: updatedLastEntry?.reinstatedAt ?? new Date(),
      };
    } else {
      // PATH B: Policy unchanged — full reinstate, course visible immediately
      const {enrollment} = await this.enrollmentService.reinstateUser(
        userId,
        courseId,
        courseVersionId,
        reinstatedBy,
        cohortId,
      );

      await this.notificationService.notifyReinstatement(
        userId,
        courseId,
        courseVersionId,
        cohortId,
      );

      const updatedHistory = (enrollment as any).ejectionHistory ?? [];
      const updatedLastEntry = updatedHistory.at(-1);

      return {
        enrollmentId: enrollment._id.toString(),
        userId,
        courseId,
        courseVersionId,
        reinstatedAt: updatedLastEntry?.reinstatedAt ?? new Date(),
      };
    }
  }

  async bulkReinstateLearners(
    userIds: string[],
    courseId: string,
    courseVersionId: string,
    reinstatedBy: string,
    cohortId?: string,
  ): Promise<{successCount: number; failureCount: number; errors: string[]}> {
    const results = await Promise.allSettled(
      userIds.map(userId =>
        this.reinstateLearner(
          userId,
          courseId,
          courseVersionId,
          reinstatedBy,
          cohortId,
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
