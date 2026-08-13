import {getFromContainer} from 'routing-controllers';
import {AutoEjectionEngine} from '#root/modules/ejectionPolicy/services/AutoEjectionEngine.js';
import {DeleteCronService} from '#root/modules/courses/services/deleteCronService.js';
import {initJobs} from '#root/bootstrap/jobs/index.js';

export const startCron = () => {
  try {
    // Get DeleteCronService from the existing container and schedule it
    const deleteCronService = getFromContainer(DeleteCronService);
    initJobs();
    deleteCronService.scheduleDeleteCron();

    console.log('✅ Delete cron job scheduled successfully');

    // scheduleProgressUpdateCron is async and was previously called without
    // await/catch here — a rejection (e.g. no courses yet on a fresh DB)
    // became an unhandled promise rejection that crashed the whole process,
    // bypassing this try/catch entirely since it runs after this function
    // returns. Attach .catch() so a failure here can't take down the server.
    deleteCronService.scheduleProgressUpdateCron().catch(error => {
      console.error('❌ Progress update cron failed:', error);
    });

    console.log('✅ Progress update cron job scheduled successfully');

    // ── Auto-Ejection Engine ──────────────────────────────────────
    const autoEjectionEngine = getFromContainer(AutoEjectionEngine);

    autoEjectionEngine.scheduleAutoEjectionCron();

    console.log('✅ Auto-ejection engine scheduled successfully');
  } catch (error) {
    console.error('❌ Failed to initialize delete cron service:', error);
  }
};
