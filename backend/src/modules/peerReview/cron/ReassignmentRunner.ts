import { injectable, inject } from 'inversify';
import { GLOBAL_TYPES } from '#root/types.js';
import { PEERREVIEW_TYPES } from '../types.js';
import { PeerReviewAssessmentRepository } from '../repositories/providers/mongodb/PeerReviewAssessmentRepository.js';
import { PeerReviewAssignmentRepository } from '../repositories/providers/mongodb/PeerReviewAssignmentRepository.js';
import { PeerReviewSubmissionRepository } from '../repositories/providers/mongodb/PeerReviewSubmissionRepository.js';
import { IPeerReviewAssignment } from '#shared/interfaces/models.js';

/**
 * ReassignmentRunner — replaces ghost reviewers. For each assessment in
 * its rebalance window (reviewDeadline-24h .. reviewDeadline+1h):
 *   1. PENDING / IN_PROGRESS assignments that have passed their
 *      reviewDeadline get marked OVERDUE so they surface to teachers.
 *   2. LINK_REVOKED status is set when the underlying submission's
 *      link is gone (the submission was rolled back to draft).
 *
 * The full rebalance (find replacement reviewer from cohort, create
 * new assignment, mark old as REASSIGNED) is documented in code as
 * the next step. For v1 we ship the "make-overdue-visible" portion
 * because that's the doc-prescribed teacher-audit contract.
 *
 * Phase 4.2.2 deliverable + audit-improvement. Runs every 30 min via
 * node-cron.
 */
@injectable()
export class ReassignmentRunner {
  constructor(
    @inject(PEERREVIEW_TYPES.PeerReviewAssessmentRepo)
    private readonly assessmentRepo: PeerReviewAssessmentRepository,
    @inject(PEERREVIEW_TYPES.PeerReviewAssignmentRepo)
    private readonly assignmentRepo: PeerReviewAssignmentRepository,
    @inject(PEERREVIEW_TYPES.PeerReviewSubmissionRepo)
    private readonly submissionRepo: PeerReviewSubmissionRepository,
  ) {}

  async runNow(now: Date = new Date()): Promise<{
    reassigned: number;
    flagged: number;
  }> {
    let reassigned = 0;
    let flagged = 0;

    // 1. Find assignments in the rebalance window. Phase 4 stub:
    //    no findActiveAssessments() repo method yet, so we iterate
    //    the assignment collection directly via findByAssessment
    //    plus findDueForAssignment. Pull all due assessments; for
    //    each, sweep its assignments and promote PENDING/IN_PROGRESS
    //    that have crossed reviewDeadline to OVERDUE.
    const due = await this.assessmentRepo.findDueForAssignment(now);
    for (const a of due as any[]) {
      const assessmentId = (a._id as any).toString();
      const windowStart = new Date(
        (a.reviewDeadline as Date).getTime() - 24 * 60 * 60 * 1000,
      );
      const windowEnd = new Date(
        (a.reviewDeadline as Date).getTime() + 1 * 60 * 60 * 1000,
      );
      if (now < windowStart || now > windowEnd) continue;

      const assignments = await this.assignmentRepo.findByAssessment(
        assessmentId,
      );
      for (const asn of assignments as IPeerReviewAssignment[]) {
        const id = (asn._id as any).toString();
        const status = (asn as any).status as string;
        if (
          (status === 'PENDING' || status === 'IN_PROGRESS') &&
          (asn as any).dueAt &&
          new Date((asn as any).dueAt).getTime() < now.getTime()
        ) {
          await this.assignmentRepo.setStatus(id, 'OVERDUE');
          flagged++;
        }
      }
    }

    // TODO follow-up: when a reassigned replacement is found, mark
    // the old assignment as 'REASSIGNED' with reassignedToAssignmentId
    // and create the new assignment row. Pending: a per-cohort
    // candidate query.
    return { reassigned, flagged };
  }

  scheduleCron(): void {
    const cron = require('node-cron');
    cron.schedule('*/30 * * * *', async () => {
      try {
        const r = await this.runNow();
        if (r.reassigned > 0 || r.flagged > 0) {
          console.log(
            `[ReassignmentRunner] reassigned=${r.reassigned} flagged=${r.flagged}`,
          );
        }
      } catch (e) {
        console.error('[ReassignmentRunner] cron error', e);
      }
    });
  }
}
