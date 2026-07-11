import {getFromContainer} from 'routing-controllers';
import {AutoEjectionEngine} from '#root/modules/ejectionPolicy/services/AutoEjectionEngine.js';
import {DeleteCronService} from '#root/modules/courses/services/deleteCronService.js';
import {initJobs} from '#root/bootstrap/jobs/index.js';
import {registerPeerReviewCrons} from '#root/bootstrap/jobs/peerReviewCrons.js';
import {getContainer} from '#root/bootstrap/loadModules.js';

export const startCron = () => {
  try {
    // Get DeleteCronService from the existing container and schedule it
    const deleteCronService = getFromContainer(DeleteCronService);
    initJobs();
    deleteCronService.scheduleDeleteCron();

    console.log('✅ Delete cron job scheduled successfully');

    deleteCronService.scheduleProgressUpdateCron();

    console.log('✅ Progress update cron job scheduled successfully');

    // ── Auto-Ejection Engine ──────────────────────────────────────
    const autoEjectionEngine = getFromContainer(AutoEjectionEngine);

    autoEjectionEngine.scheduleAutoEjectionCron();

    console.log('✅ Auto-ejection engine scheduled successfully');

    // ── Peer-review cron runners ──────────────────────────────────
    // The side-effect import in peerReviewCrons.ts runs before the
    // container is populated, so its own registration attempt logs a
    // warning and no-ops. Now that loadAppModules has finished, we
    // call the explicit registration here so AssignmentRunner /
    // ReassignmentRunner / FinalizationRunner / DueDateReminderRunner
    // actually tick.
    try {
      registerPeerReviewCrons(getContainer());
    } catch (e) {
      console.error('❌ Failed to register peer-review crons:', e);
    }
  } catch (error) {
    console.error('❌ Failed to initialize delete cron service:', error);
  }
};
