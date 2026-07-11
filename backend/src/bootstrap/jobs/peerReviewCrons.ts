/**
 * Peer-review cron registration.
 *
 * Phase 4.2.2 + audit-improvement. Matches the existing cron
 * registration pattern (`evaluateSlotFulfillment.ts`): import for
 * side effects, schedule at module load time using getContainer().
 *
 * Public API:
 *   - registerPeerReviewCrons(container): explicit registration,
 *     used by tests + manual bootstrap paths.
 *
 * The side-effect import below auto-registers when this module is
 * imported. The `bootstrap/jobs/index.ts` aggregator already pulls
 * us in via `import './peerReviewCrons.js'`.
 */
import { Container } from 'inversify';
import { AssignmentRunner } from '#peerReview/cron/AssignmentRunner.js';
import { ReassignmentRunner } from '#peerReview/cron/ReassignmentRunner.js';
import { FinalizationRunner } from '#peerReview/cron/FinalizationRunner.js';
import { DueDateReminderRunner } from '#peerReview/cron/DueDateReminderRunner.js';
import { PEERREVIEW_TYPES } from '#peerReview/types.js';
import { getContainer } from '#root/bootstrap/loadModules.js';

let registered = false;

export function registerPeerReviewCrons(container: Container): void {
  if (registered) return;
  registered = true;
  const assignment = container.get<AssignmentRunner>(
    PEERREVIEW_TYPES.AssignmentRunner,
  );
  const reassignment = container.get<ReassignmentRunner>(
    PEERREVIEW_TYPES.ReassignmentRunner,
  );
  const finalization = container.get<FinalizationRunner>(
    PEERREVIEW_TYPES.FinalizationRunner,
  );
  const dueReminders = container.get<DueDateReminderRunner>(
    PEERREVIEW_TYPES.DueDateReminderRunner,
  );
  assignment.scheduleCron();
  reassignment.scheduleCron();
  finalization.scheduleCron();
  dueReminders.scheduleCron();
  console.log('[peerReview] crons registered');
}

// Side-effect self-registration at module load time. Safe because
// getContainer() returns the populated container by the time the
// `import './peerReviewCrons.js'` line in bootstrap/jobs/index.ts
// runs (loadModules completes before startCron).
//
// In practice the side-effect import fires BEFORE the container is
// populated (the import chain runs before `await loadAppModules()` in
// index.ts), so the catch below hits. Production uses the explicit
// registerPeerReviewCrons(getContainer()) call from startCron() AFTER
// loadAppModules completes — that path is the supported one. This
// try/catch remains so test paths that import peerReviewCrons.js for
// type access don't crash on `getContainer()`.
try {
  registerPeerReviewCrons(getContainer());
} catch (e) {
  if (process.env.NODE_ENV !== 'test') {
    console.warn(
      '[peerReview] crons not registered at load (will retry from startCron):',
      e instanceof Error ? e.message : String(e),
    );
  }
}
