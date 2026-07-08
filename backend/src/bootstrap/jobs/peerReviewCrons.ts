/**
 * Bootstrap entry that wires up all 3 peer-review crons.
 *
 * Phase 4.2.2 deliverable. The server entry imports this file and
 * calls `registerPeerReviewCrons(container)` on startup. Each cron's
 * own `scheduleCron()` does the actual node-cron registration.
 */
import { Container } from 'inversify';
import { AssignmentRunner } from '#peerReview/cron/AssignmentRunner.js';
import { ReassignmentRunner } from '#peerReview/cron/ReassignmentRunner.js';
import { FinalizationRunner } from '#peerReview/cron/FinalizationRunner.js';
import { PEERREVIEW_TYPES } from '#peerReview/types.js';

export function registerPeerReviewCrons(container: Container): void {
  const assignment = container.get<AssignmentRunner>(
    PEERREVIEW_TYPES.AssignmentRunner,
  );
  const reassignment = container.get<ReassignmentRunner>(
    PEERREVIEW_TYPES.ReassignmentRunner,
  );
  const finalization = container.get<FinalizationRunner>(
    PEERREVIEW_TYPES.FinalizationRunner,
  );
  assignment.scheduleCron();
  reassignment.scheduleCron();
  finalization.scheduleCron();
  console.log('[peerReview] crons registered');
}
