import 'reflect-metadata';
import {injectable, inject} from 'inversify';
import {ObjectId, ClientSession} from 'mongodb';
import {NotificationRepository} from '#root/shared/database/providers/mongo/repositories/NotificationRepository.js';
import {NOTIFICATIONS_TYPES} from '../types.js';
import {INotification} from '#root/shared/database/interfaces/INotification.js';
import {EnrollmentRepository} from '#root/shared/database/providers/mongo/repositories/EnrollmentRepository.js';
import {USERS_TYPES} from '#root/modules/users/types.js';
import {UserRepository} from '#root/shared/database/providers/mongo/repositories/UserRepository.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {ICourseRepository} from '#root/shared/database/interfaces/ICourseRepository.js';
import {EJECTION_POLICY_TYPES} from '#root/modules/ejectionPolicy/types.js';
import {AppealRepository} from '#root/shared/database/providers/mongo/repositories/AppealRepository.js';

@injectable()
export class NotificationService {
  constructor(
    @inject(NOTIFICATIONS_TYPES.NotificationRepo)
    private readonly notificationRepo: NotificationRepository,
    @inject(USERS_TYPES.EnrollmentRepo)
    private readonly enrollmentRepo: EnrollmentRepository,
    @inject(GLOBAL_TYPES.UserRepo)
    private readonly userRepo: UserRepository,
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,
    @inject(EJECTION_POLICY_TYPES.AppealRepo)
    private readonly appealRepo: AppealRepository,
  ) {}

  // ── Core Methods ────────────────────────────────────────────────

  async getUserNotifications(
    userId: string,
    limit: number = 20,
    onlyUnread: boolean = false,
  ): Promise<INotification[]> {
    return this.notificationRepo.findByUserId(userId, limit, onlyUnread);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepo.countUnread(userId);
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    return this.notificationRepo.markAsRead(notificationId, userId);
  }

  async markAllAsRead(userId: string): Promise<void> {
    return this.notificationRepo.markAllAsRead(userId);
  }

  // ── Ejection Notification ────────────────────────────────────────

  async notifyEjection(
    userId: string,
    courseId: string,
    courseVersionId: string,
    reason: string,
    cohortId?: string,
    session?: ClientSession,
    policy?: any,
    enrollmentId?: string,
  ): Promise<void> {
    const course = await this.courseRepo.read(courseId);
    const courseName = course?.name ?? 'your course';
    const appealDeadline = policy?.actions?.appealDeadlineDays
      ? new Date(
          Date.now() + policy.actions.appealDeadlineDays * 24 * 60 * 60 * 1000,
        )
      : null;

    const notification: Omit<INotification, '_id'> = {
      userId: new ObjectId(userId),
      type: 'ejection',
      title: 'You have been ejected from a course',
      message: `You have been removed from "${courseName}". Reason: ${reason}`,
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(courseVersionId),
      ...(cohortId ? {cohortId: new ObjectId(cohortId)} : {}),
      metadata: {
        allowAppeal: policy?.actions?.allowAppeal ?? false,
        appealDeadline,
        ...(enrollmentId ? {enrollmentId: new ObjectId(enrollmentId)} : {}),
      },
      read: false,
      createdAt: new Date(),
    };

    await this.notificationRepo.create(notification, session);
  }

  // ── Reinstatement Notification ───────────────────────────────────

  async notifyReinstatement(
    userId: string,
    courseId: string,
    courseVersionId: string,
    cohortId?: string,
    session?: ClientSession,
  ): Promise<void> {
    const course = await this.courseRepo.read(courseId);
    const courseName = course?.name ?? 'your course';

    const notification: Omit<INotification, '_id'> = {
      userId: new ObjectId(userId),
      type: 'reinstatement',
      title: 'You have been reinstated to a course',
      message: `Your access to "${courseName}" has been restored. You can continue from where you left off.`,
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(courseVersionId),
      ...(cohortId ? {cohortId: new ObjectId(cohortId)} : {}),
      read: false,
      createdAt: new Date(),
    };

    await this.notificationRepo.create(notification, session);
  }

  // ── Policy Notification (notify all students in cohort) ──────────

  async notifyPolicyChange(
    courseId: string,
    courseVersionId: string,
    cohortId: string,
    policyName: string,
    isNew: boolean,
    policyId?: string,
    session?: ClientSession,
  ): Promise<void> {
    const course = await this.courseRepo.read(courseId);
    const courseName = course?.name ?? 'your course';

    // Find all active non-ejected students in this cohort
    const enrollments = await this.enrollmentRepo.findActiveEnrollmentsByCohort(
      courseId,
      courseVersionId,
      cohortId,
    );

    if (!enrollments.length) return;

    const notifications: Omit<INotification, '_id'>[] = enrollments.map(
      enrollment => ({
        userId: new ObjectId(enrollment.userId.toString()),
        type: (isNew
          ? 'policy_created'
          : 'policy_updated') as INotification['type'],
        title: isNew
          ? `New ejection policy for "${courseName}"`
          : `Ejection policy updated for "${courseName}"`,
        message: isNew
          ? `A new ejection policy "${policyName}" has been created for your cohort in "${courseName}".`
          : `The ejection policy "${policyName}" has been updated for your cohort in "${courseName}".`,
        courseId: new ObjectId(courseId),
        courseVersionId: new ObjectId(courseVersionId),
        cohortId: new ObjectId(cohortId),
        ...(policyId ? {policyId: new ObjectId(policyId)} : {}),
        read: false,
        createdAt: new Date(),
      }),
    );

    await this.notificationRepo.createMany(notifications, session);
  }
  async notifyPolicyChangeToUser(
    userId: string,
    courseId: string,
    courseVersionId: string,
    cohortId: string,
    policyName: string,
    policyId?: string,
    session?: ClientSession,
  ): Promise<void> {
    const course = await this.courseRepo.read(courseId);
    const courseName = course?.name ?? 'your course';

    const notification: Omit<INotification, '_id'> = {
      userId: new ObjectId(userId),
      type: 'policy_updated',
      title: `Policy updated — re-acknowledgement required`,
      message: `The ejection policy "${policyName}" was updated while you were away. Re-acknowledge it to access "${courseName}".`,
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(courseVersionId),
      cohortId: new ObjectId(cohortId),
      ...(policyId ? {policyId: new ObjectId(policyId)} : {}),
      read: false,
      createdAt: new Date(),
    };

    await this.notificationRepo.create(notification, session);
  }
  async notifyInactivityWarning(
    userId: string,
    courseId: string,
    courseVersionId: string,
    daysInactive: number,
    thresholdDays: number,
    cohortId?: string,
    session?: ClientSession,
  ): Promise<void> {
    const course = await this.courseRepo.read(courseId);
    const courseName = course?.name ?? 'your course';

    const notification: Omit<INotification, '_id'> = {
      userId: new ObjectId(userId),
      type: 'inactivity_warning',
      title: 'You are at risk of being removed',
      message: `You have been inactive in "${courseName}" for ${daysInactive} days. You will be removed if you remain inactive for ${thresholdDays} days.`,
      courseId: new ObjectId(courseId),
      courseVersionId: new ObjectId(courseVersionId),
      ...(cohortId ? {cohortId: new ObjectId(cohortId)} : {}),
      read: false,
      createdAt: new Date(),
    };

    await this.notificationRepo.create(notification, session);
  }
  async createNotification(
    notification: Omit<INotification, '_id'>,
    session?: ClientSession,
  ): Promise<void> {
    await this.notificationRepo.create(notification, session);
  }

  async enrichWithAppealStatus(
    userId: string,
    notifications: INotification[],
  ): Promise<INotification[]> {
    return Promise.all(
      notifications.map(async n => {
        if (
          n.type !== 'ejection' ||
          !n.courseId ||
          !n.courseVersionId ||
          !n.cohortId
        )
          return n;

        // const hasPending = await this.appealRepo.existsPending(
        //   userId,
        //   n.courseId.toString(),
        //   n.courseVersionId.toString(),
        //   n.cohortId.toString(),
        // );

        // return {
        //   ...n,
        //   metadata: {
        //     ...(n.metadata ?? {}),
        //     appealPending: hasPending,
        //   },
        //   extra: {
        //     ...(n.extra ?? {}),
        //   },
        // };
        const hasAnyAppeal = await this.appealRepo.existsAnyAfterDate(
          userId,
          n.courseId.toString(),
          n.courseVersionId.toString(),
          n.cohortId.toString(),
          n.createdAt, // ejection notification timestamp as lower bound
        );

        return {
          ...n,
          metadata: {
            ...(n.metadata ?? {}),
            appealPending: hasAnyAppeal,
          },
        };
      }),
    );
  }
}
