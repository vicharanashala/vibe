import { injectable, inject } from 'inversify';
import { GLOBAL_TYPES } from '#root/types.js';
import { PEERREVIEW_TYPES } from '../types.js';
import { PeerReviewAssessmentRepository } from '../repositories/providers/mongodb/PeerReviewAssessmentRepository.js';
import { PeerReviewAssignmentService } from '../services/PeerReviewAssignmentService.js';

/**
 * AssignmentRunner — picks up assessments whose submissionDeadline has
 * passed and runs the assignment algorithm.
 *
 * Phase 4.2.2 deliverable. Runs every minute via node-cron.
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
  ) {}

  /**
   * Run-once. Idempotent: assessments that have already been assigned
   * are skipped. Returns a summary of what happened.
   */
  async runNow(now: Date = new Date()): Promise<{
    ran: Array<{ assessmentId: string; status: string; pairsCreated?: number; algorithm?: string }>;
    errors: Array<{ assessmentId: string; error: string }>;
  }> {
    const due = await this.assessmentRepo.findDueForAssignment(now);
    const ran: Array<any> = [];
    const errors: Array<any> = [];
    for (const a of due) {
      const id = (a._id as any).toString();
      try {
        const result = await this.service.runForAssessment(id);
        ran.push({ assessmentId: id, ...result });
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
