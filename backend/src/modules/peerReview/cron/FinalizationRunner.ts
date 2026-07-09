import { injectable, inject } from 'inversify';
import cron from 'node-cron';
import { GLOBAL_TYPES } from '#root/types.js';
import { PEERREVIEW_TYPES } from '../types.js';
import { PeerReviewAssessmentRepository } from '../repositories/providers/mongodb/PeerReviewAssessmentRepository.js';

/**
 * FinalizationRunner — fires when the review deadline has passed.
 * For Phase 4 this is a STUB that just stamps closedAt. The real
 * finalization (compute finalScores, fire notifications) lands in
 * Phase 5.
 *
 * Phase 4.2.2 deliverable. Runs every minute via node-cron.
 */
@injectable()
export class FinalizationRunner {
  constructor(
    @inject(PEERREVIEW_TYPES.PeerReviewAssessmentRepo)
    private readonly assessmentRepo: PeerReviewAssessmentRepository,
  ) {}

  async runNow(now: Date = new Date()): Promise<{
    finalized: number;
  }> {
    // Find all assessments whose reviewDeadline has passed and are
    // not yet closed. The repo has setClosed() but no
    // findFinalizableAssessment(); the Phase 5 follow-up adds it.
    // For Phase 4 we just return 0 finalized.
    void now;
    return { finalized: 0 };
  }

  scheduleCron(): void {
    cron.schedule('* * * * *', async () => {
      try {
        const r = await this.runNow();
        if (r.finalized > 0) {
          console.log(`[FinalizationRunner] finalized=${r.finalized}`);
        }
      } catch (e) {
        console.error('[FinalizationRunner] cron error', e);
      }
    });
  }
}
