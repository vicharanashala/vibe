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

    // ── Peer-Review crons ─────────────────────────────────────────
    // The peerReviewCrons side-effect import ran BEFORE the container
    // was populated, so its self-registration silently failed. Do it
    // explicitly here, after loadAppModules has run.
    registerPeerReviewCrons(getContainer());
    console.log('✅ Peer-review crons scheduled successfully');
  } catch (error) {
    console.error('❌ Failed to initialize cron service:', error);
  }
};
