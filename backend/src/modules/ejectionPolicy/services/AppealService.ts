import 'reflect-metadata';
import {injectable, inject} from 'inversify';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from 'routing-controllers';
import {ObjectId} from 'mongodb';

import {EJECTION_POLICY_TYPES} from '../types.js';
import {AppealRepository} from '#root/shared/database/providers/mongo/repositories/AppealRepository.js';
import {EjectionPolicyService} from './EjectionPolicyService.js';
import {EnrollmentService} from '#root/modules/users/services/EnrollmentService.js';
import {NotificationService} from '#root/modules/notifications/services/NotificationService.js';
import {USERS_TYPES} from '#root/modules/users/types.js';
import {UserService} from '#root/modules/users/services/UserService.js';

@injectable()
export class AppealService {
  constructor(
    @inject(EJECTION_POLICY_TYPES.AppealRepo)
    private readonly appealRepo: AppealRepository,

    @inject(EJECTION_POLICY_TYPES.EjectionPolicyService)
    private readonly policyService: EjectionPolicyService,

    @inject(USERS_TYPES.EnrollmentService)
    private readonly enrollmentService: EnrollmentService,

    @inject(USERS_TYPES.UserService)
    private readonly userService: UserService,

    @inject(EJECTION_POLICY_TYPES.NotificationService)
    private readonly notificationService: NotificationService,
  ) {}

  // ================= CREATE =================

  async createAppeal(
    userId: string,
    courseId: string,
    versionId: string,
    cohortId: string,
    reason: string,
    evidenceUrl?: string,
  ): Promise<string> {
    const enrollment = await this.enrollmentService.findAnyEnrollment(
      userId,
      courseId,
      versionId,
      cohortId,
    );
    const {firstName, lastName, email} =
      await this.userService.getUserById(userId);

    const [policy] = await this.policyService.getActivePoliciesForCourse(
      courseId,
      versionId,
      cohortId,
    );

    if (!policy?.actions?.allowAppeal) {
      throw new ForbiddenError('Appeals are disabled for this course');
    }

    const lastEjection = (enrollment as any)?.ejectionHistory?.at(-1);

    if (!lastEjection) {
      throw new BadRequestError('You can only appeal after being ejected');
    }
    const ejectedAt = lastEjection?.ejectedAt;

    const daysPassed =
      (Date.now() - new Date(ejectedAt).getTime()) / (1000 * 60 * 60 * 24);

    if (daysPassed > policy.actions.appealDeadlineDays) {
      throw new ForbiddenError('Appeal deadline has passed');
    }

    const exists = await this.appealRepo.existsPending(
      userId,
      courseId,
      versionId,
      cohortId,
    );

    if (exists) {
      throw new BadRequestError('You already have a pending appeal');
    }

    // validate URL
    if (evidenceUrl) {
      try {
        new URL(evidenceUrl);
      } catch {
        throw new BadRequestError('Invalid evidence link');
      }
    }

    const appealId = await this.appealRepo.create({
      userId: new ObjectId(userId),
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(versionId),
      cohortId: new ObjectId(cohortId),
      policyId: new ObjectId(policy._id),
      reason,
      evidenceUrl,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const instructors =
      await this.enrollmentService.getNonStudentEnrollmentsByCourseVersion(
        courseId,
        versionId,
      );

    console.log('INSTRUCTORS:', instructors);

    if (!instructors.length) {
      console.log('❌ No instructors found');
      return appealId;
    }

    await Promise.all(
      instructors.map(instructor =>
        this.notificationService.createNotification({
          userId: new ObjectId(instructor.userId.toString()),

          type: 'appeal_submitted',
          title: 'New Appeal Submitted',
          message: `${firstName} ${lastName} has submitted an appeal`,

          courseId: new ObjectId(policy.courseId.toString()),
          courseVersionId: new ObjectId(policy.courseVersionId.toString()),
          cohortId: new ObjectId(policy.cohortId.toString()),
          policyId: new ObjectId(policy._id.toString()),

          read: false,
          createdAt: new Date(),

          extra: {
            appealId: appealId.toString(),
            email,
            firstName,
            lastName,
          },
        }),
      ),
    );
    return appealId;
  }

  // ================= GET =================

  async getAppeals(filters: any) {
    return this.appealRepo.findAll(filters);
  }
  async getAppealById(appealId: string) {
    const appeal = await this.appealRepo.findById(appealId);

    if (!appeal) throw new NotFoundError('Appeal not found');

    return appeal;
  }

  // ================= APPROVE =================

  async approveAppeal(appealId: string, adminId: string) {
    const appeal = await this.appealRepo.findById(appealId);

    if (!appeal) throw new NotFoundError('Appeal not found');
    if (appeal.status !== 'PENDING') {
      throw new BadRequestError('Appeal already processed');
    }

    await this.enrollmentService.reinstateUser(
      appeal.userId.toString(),
      appeal.courseId.toString(),
      appeal.courseVersionId.toString(),
      adminId,
      appeal.cohortId?.toString(),
    );

    await this.appealRepo.update(appealId, {
      status: 'APPROVED',
      reviewedBy: new ObjectId(adminId),
      reviewedAt: new Date(),
    });

    await this.notificationService.createNotification({
      userId: appeal.userId,
      type: 'appeal_approved',
      title: 'Appeal Approved',
      message: 'Your appeal has been approved. You are reinstated.',
      courseId: appeal.courseId,
      courseVersionId: appeal.courseVersionId,
      cohortId: appeal.cohortId,
      policyId: appeal.policyId,
      read: false,
      createdAt: new Date(),
    });
  }

  // ================= REJECT =================

  async rejectAppeal(appealId: string, adminId: string, reason: string) {
    const appeal = await this.appealRepo.findById(appealId);

    if (!appeal) throw new NotFoundError('Appeal not found');
    if (appeal.status !== 'PENDING') {
      throw new BadRequestError('Appeal already processed');
    }

    await this.appealRepo.update(appealId, {
      status: 'REJECTED',
      reviewedBy: new ObjectId(adminId),
      reviewedAt: new Date(),
      adminResponse: reason,
    });

    await this.notificationService.createNotification({
      userId: appeal.userId,
      type: 'appeal_rejected',
      title: 'Appeal Rejected',
      message: 'Your appeal has been rejected.',
      courseId: appeal.courseId,
      courseVersionId: appeal.courseVersionId,
      cohortId: appeal.cohortId,
      policyId: appeal.policyId,
      read: false,
      createdAt: new Date(),
    });
  }
}
