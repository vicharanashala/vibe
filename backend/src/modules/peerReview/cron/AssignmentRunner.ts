import { injectable, inject } from 'inversify';
import { GLOBAL_TYPES } from '#root/types.js';
import { PEERREVIEW_TYPES } from '../types.js';
import { PeerReviewAssessmentRepository } from '../repositories/providers/mongodb/PeerReviewAssessmentRepository.js';
import { PeerReviewAssignmentService } from '../services/PeerReviewAssignmentService.js';
import { PeerReviewNotificationService } from '../services/PeerReviewNotificationService.js';
import { PeerReviewAssignmentRepository } from '../repositories/providers/mongodb/PeerReviewAssignmentRepository.js';

/**
 * AssignmentRunner — picks up assessments whose submissionDeadline has
 * passed, runs the assignment algorithm, and fires
 * notifyAssignmentsOut per reviewer.
 *
 * Phase 4.2.2 deliverable + Phase 5.2.4 cron-to-notifier wiring.
 * Runs every minute via node-cron.
 *
 * The function is split into `runNow()` (pure, testable) and
 * `scheduleCron()` (registers the cron). Tests call `runNow()` directly
 * to avoid the live-clock dependency.
 */
@injectable()
export class AssignmentRunner {
  constructor(
    @inject(PEERREVIEW_TYPES.PeerReviewAssessmentRepo)
    private readonly assessmentRepo: PeerReviewAssessmentRepository,
    @inject(PEERREVIEW_TYPES.PeerReviewAssignmentService)
    private readonly service: PeerReviewAssignmentService,
    @inject(PEERREVIEW_TYPES.PeerReviewAssignmentRepo)
    private readonly assignmentRepo: PeerReviewAssignmentRepository,
    @inject(PEERREVIEW_TYPES.PeerReviewNotificationService)
    private readonly notifier: PeerReviewNotificationService,
  ) {}

  /**
   * Run-once. Idempotent: assessments that have already been assigned
   * are skipped. Returns a summary of what happened, including the
   * number of notifications fired.
   */
  async runNow(now: Date = new Date()): Promise<{
    ran: Array<{ assessmentId: string; status: string; pairsCreated?: number; algorithm?: string; notifiedReviewers?: number }>;
    errors: Array<{ assessmentId: string; error: string }>;
  }> {
    const due = await this.assessmentRepo.findDueForAssignment(now);
    const ran: Array<any> = [];
    const errors: Array<any> = [];
    for (const a of due) {
      const id = (a._id as any).toString();
      try {
        const result = await this.service.runForAssessment(id);
        let notifiedReviewers = 0;
        if (result.status === 'ran') {
          // Find every assignment row for this assessment and notify
          // each unique reviewer once with their total count.
          const assignments = await this.assignmentRepo.findByAssessment(
            id,
          );
          const byReviewer = new Map<string, number>();
          for (const asn of assignments as any[]) {
            const reviewerId = (asn.reviewerId as any).toString();
            byReviewer.set(reviewerId, (byReviewer.get(reviewerId) ?? 0) + 1);
          }
          for (const [reviewerId, count] of byReviewer.entries()) {
            await this.notifier.notifyAssignmentsOut({
              userId: reviewerId,
              courseId: (a as any).courseId?.toString(),
              courseVersionId: (a as any).courseVersionId?.toString(),
              assessmentId: id,
              assessmentTitle: (a as any).title ?? 'Peer-review assessment',
              dueAt: (a as any).reviewDeadline,
              count,
            });
            notifiedReviewers++;
          }
        }
        ran.push({
          assessmentId: id,
          ...result,
          notifiedReviewers,
        });
      } catch (e: any) {
        errors.push({ assessmentId: id, error: String(e?.message ?? e) });
      }
    }
    return { ran, errors };
  }

  /**
   * Register the cron with node-cron. The cron is registered only when
   * the module is bootstrapped in production; tests should not call this.
   */
  scheduleCron(): void {
    // Defer the actual cron import to avoid loading it in tests
    const cron = require('node-cron');
    cron.schedule('* * * * *', async () => {
      try {
        const result = await this.runNow();
        if (result.ran.length > 0) {
          console.log(
            `[AssignmentRunner] ran ${result.ran.length} assessments, errors=${result.errors.length}`,
          );
        }
      } catch (e) {
        console.error('[AssignmentRunner] cron error', e);
      }
    });
  }
}
