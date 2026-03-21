import 'reflect-metadata';
import {injectable, inject} from 'inversify';
import {USERS_TYPES} from '#root/modules/users/types.js';
import {EnrollmentService} from '#root/modules/users/services/EnrollmentService.js';

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
  ) {}

  async reinstateLearner(
    userId: string,
    courseId: string,
    courseVersionId: string,
    reinstatedBy: string,
    cohortId?: string,
  ): Promise<ReinstatementResult> {
    const {enrollment} = await this.enrollmentService.reinstateUser(
      userId,
      courseId,
      courseVersionId,
      reinstatedBy,
      cohortId,
    );

    // Get the last history entry for reinstatedAt
    const history = (enrollment as any).ejectionHistory ?? [];
    const lastEntry = history.at(-1);

    return {
      enrollmentId: enrollment._id.toString(),
      userId,
      courseId,
      courseVersionId,
      reinstatedAt: lastEntry?.reinstatedAt ?? new Date(),
    };
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
