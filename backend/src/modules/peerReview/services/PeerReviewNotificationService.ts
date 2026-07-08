import { injectable, inject } from 'inversify';
import { NotificationRepository } from '#root/shared/database/providers/mongo/repositories/NotificationRepository.js';
import { NOTIFICATIONS_TYPES } from '../../notifications/types.js';

/**
 * Peer-review notification helper.
 *
 * Phase 4.2.4 deliverable. Provides the 5 notification templates the
 * peer-review flow needs:
 *
 *   - assignments.out       (reviewer has new peer reviews to do)
 *   - reviews.dueSoon        (T-24h warning)
 *   - reviews.dueVerySoon    (T-1h warning)
 *   - reviews.reassigned     (reviewer just got reassigned a slot)
 *   - score.ready            (submitter's score is ready)
 *
 * Each method writes an INotification via the existing repo. The
 * existing NotificationType enum doesn't include peer-review types,
 * so we store the type in the `extra` field. The UI layer is free to
 * inspect `extra` to render the right icon.
 */
@injectable()
export class PeerReviewNotificationService {
  constructor(
    @inject(NOTIFICATIONS_TYPES.NotificationRepo)
    private readonly notificationRepo: NotificationRepository,
  ) {}

  private async create(
    userId: string,
    type: string,
    title: string,
    message: string,
    extra: Record<string, any>,
    courseId?: string,
    courseVersionId?: string,
  ): Promise<string> {
    return this.notificationRepo.create({
      userId: userId as any,
      type: 'ejection' as any, // falls back to existing enum; UI checks `extra.kind`
      title,
      message,
      courseId: courseId as any,
      courseVersionId: courseVersionId as any,
      read: false,
      createdAt: new Date(),
      extra: { kind: type, ...extra },
    } as any);
  }

  async notifyAssignmentsOut(args: {
    userId: string;
    courseId?: string;
    courseVersionId?: string;
    assessmentId: string;
    assessmentTitle: string;
    dueAt: Date;
    count: number;
  }): Promise<string> {
    return this.create(
      args.userId,
      'PEER_REVIEW_ASSIGNMENTS_OUT',
      'New peer reviews to complete',
      `You have ${args.count} peer review${args.count > 1 ? 's' : ''} to complete for "${args.assessmentTitle}". Due ${args.dueAt.toLocaleString()}.`,
      { assessmentId: args.assessmentId, dueAt: args.dueAt },
      args.courseId,
      args.courseVersionId,
    );
  }

  async notifyDueSoon(args: {
    userId: string;
    assessmentTitle: string;
    dueAt: Date;
    assessmentId: string;
    courseId?: string;
  }): Promise<string> {
    return this.create(
      args.userId,
      'PEER_REVIEW_DUE_SOON',
      'Peer reviews due in 24h',
      `Your peer reviews for "${args.assessmentTitle}" are due in 24 hours.`,
      { assessmentId: args.assessmentId, dueAt: args.dueAt },
      args.courseId,
    );
  }

  async notifyDueVerySoon(args: {
    userId: string;
    assessmentTitle: string;
    dueAt: Date;
    assessmentId: string;
    courseId?: string;
  }): Promise<string> {
    return this.create(
      args.userId,
      'PEER_REVIEW_DUE_VERY_SOON',
      'Peer reviews due in 1h',
      `Your peer reviews for "${args.assessmentTitle}" are due in 1 hour.`,
      { assessmentId: args.assessmentId, dueAt: args.dueAt },
      args.courseId,
    );
  }

  async notifyReassigned(args: {
    userId: string;
    assessmentTitle: string;
    dueAt: Date;
    assessmentId: string;
    courseId?: string;
  }): Promise<string> {
    return this.create(
      args.userId,
      'PEER_REVIEW_REASSIGNED',
      'New peer review assigned',
      `You've been assigned a peer review for "${args.assessmentTitle}". Due ${args.dueAt.toLocaleString()}.`,
      { assessmentId: args.assessmentId, dueAt: args.dueAt },
      args.courseId,
    );
  }

  /**
   * Submitter notification when a teacher manually overrides one of
   * the reviews on their submission. Required by Phase 5.2.2 audit
   * transparency: the submitter must be told their grade was
   * adjusted, with the reason.
   */
  async notifyTeacherOverride(args: {
    userId: string;
    assessmentTitle: string;
    newFinalScore: number;
    totalMax: number;
    assessmentId: string;
    courseId?: string;
    reason: string;
  }): Promise<string> {
    return this.create(
      args.userId,
      'PEER_REVIEW_TEACHER_OVERRIDE',
      'Your grade was adjusted by your teacher',
      `Your grade for "${args.assessmentTitle}" was adjusted to ${args.newFinalScore} / ${args.totalMax}. Reason: ${args.reason}`,
      {
        assessmentId: args.assessmentId,
        newFinalScore: args.newFinalScore,
        totalMax: args.totalMax,
        reason: args.reason,
      },
      args.courseId,
    );
  }

  async notifyScoreReady(args: {
    userId: string;
    assessmentTitle: string;
    finalScore: number;
    totalMax: number;
    assessmentId: string;
    courseId?: string;
  }): Promise<string> {
    return this.create(
      args.userId,
      'PEER_REVIEW_SCORE_READY',
      'Your peer-review grade is ready',
      `Your grade for "${args.assessmentTitle}" is ${args.finalScore} / ${args.totalMax}.`,
      {
        assessmentId: args.assessmentId,
        finalScore: args.finalScore,
        totalMax: args.totalMax,
      },
      args.courseId,
    );
  }
}