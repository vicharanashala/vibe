import { injectable, inject } from 'inversify';
import { PEERREVIEW_TYPES } from '../types.js';
import { PeerReviewAssessmentRepository } from '../repositories/providers/mongodb/PeerReviewAssessmentRepository.js';
import { PeerReviewAssignmentRepository } from '../repositories/providers/mongodb/PeerReviewAssignmentRepository.js';
import { PeerReviewNotificationService } from '../services/PeerReviewNotificationService.js';

/**
 * DueDateReminderRunner — fires notifyDueSoon (T-24h) and
 * notifyDueVerySoon (T-1h) to reviewers who have pending
 * assignments for an assessment.
 *
 * Implementation: every minute, scan every active (assignmentRunAt set,
 * closedAt missing) assessment. For each:
 *   - reviewDeadline - now <= 24h and not yet notified → fire
 *     notifyDueSoon to every reviewer with at least one PENDING
 *     assignment for the assessment.
 *   - reviewDeadline - now <= 1h and not yet notified → fire
 *     notifyDueVerySoon.
 *
 * Idempotency: stamp `dueSoonNotifiedAt` / `dueVerySoonNotifiedAt` on
 * the assessment so we don't double-fire.
 */
@injectable()
export class DueDateReminderRunner {
  constructor(
    @inject(PEERREVIEW_TYPES.PeerReviewAssessmentRepo)
    private readonly assessmentRepo: PeerReviewAssessmentRepository,
    @inject(PEERREVIEW_TYPES.PeerReviewAssignmentRepo)
    private readonly assignmentRepo: PeerReviewAssignmentRepository,
    @inject(PEERREVIEW_TYPES.PeerReviewNotificationService)
    private readonly notifier: PeerReviewNotificationService,
  ) {}

  async runNow(now: Date = new Date()): Promise<{
    soonNotified: number;
    verySoonNotified: number;
  }> {
    // Find every assessment whose reviewDeadline hasn't passed yet but
    // whose assignment algorithm has run (so reviewers have work).
    const due = await this.assessmentRepo.findDueForAssignment(now);
    let soonNotified = 0;
    let verySoonNotified = 0;
    for (const a of due as any[]) {
      const aid = (a._id as any).toString();
      const reviewDeadline = new Date(a.reviewDeadline).getTime();
      const msUntilDue = reviewDeadline - now.getTime();

      // 24h window: 23h <= msUntilDue <= 25h (covers cron-minute jitter
      // but stays far enough from the 1h boundary to avoid double-fire).
      if (
        !a.dueSoonNotifiedAt &&
        msUntilDue <= 24 * 60 * 60 * 1000 &&
        msUntilDue > 23 * 60 * 60 * 1000
      ) {
        soonNotified += await this.notifyReviewers(a, aid, 'soon');
        await this.assessmentRepo.update(aid, {
          dueSoonNotifiedAt: new Date(),
        } as any);
      }
      // 1h window: 50min <= msUntilDue <= 70min.
      if (
        !a.dueVerySoonNotifiedAt &&
        msUntilDue <= 60 * 60 * 1000 &&
        msUntilDue > 50 * 60 * 1000
      ) {
        verySoonNotified += await this.notifyReviewers(a, aid, 'verySoon');
        await this.assessmentRepo.update(aid, {
          dueVerySoonNotifiedAt: new Date(),
        } as any);
      }
    }
    return { soonNotified, verySoonNotified };
  }

  private async notifyReviewers(
    a: any,
    aid: string,
    kind: 'soon' | 'verySoon',
  ): Promise<number> {
    const assignments = await this.assignmentRepo.findByAssessment(aid);
    const reviewerIds = new Set<string>();
    for (const asn of assignments as any[]) {
      if ((asn as any).status === 'PENDING' || (asn as any).status === 'IN_PROGRESS') {
        reviewerIds.add((asn.reviewerId as any).toString());
      }
    }
    let notified = 0;
    for (const reviewerId of reviewerIds) {
      try {
        if (kind === 'soon') {
          await this.notifier.notifyDueSoon({
            userId: reviewerId,
            assessmentTitle: a.title ?? 'Peer-review assessment',
            assessmentId: aid,
            dueAt: a.reviewDeadline,
            courseId: a.courseId?.toString(),
          });
        } else {
          await this.notifier.notifyDueVerySoon({
            userId: reviewerId,
            assessmentTitle: a.title ?? 'Peer-review assessment',
            assessmentId: aid,
            dueAt: a.reviewDeadline,
            courseId: a.courseId?.toString(),
          });
        }
        notified++;
      } catch (err) {
        console.warn(
          `[DueDateReminderRunner] notify (${kind}) failed for reviewer ${reviewerId}:`,
          err,
        );
      }
    }
    return notified;
  }

  scheduleCron(): void {
    import('node-cron').then(({default: cron}) => {
      cron.schedule('*/1 * * * *', async () => {
        try {
          const r = await this.runNow();
          if (r.soonNotified > 0 || r.verySoonNotified > 0) {
            console.log(
              `[DueDateReminderRunner] soon=${r.soonNotified} verySoon=${r.verySoonNotified}`,
            );
          }
        } catch (e) {
          console.error('[DueDateReminderRunner] cron error', e);
        }
      });
    });
  }
}