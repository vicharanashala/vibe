import {getFromContainer} from 'routing-controllers';
import {AutoEjectionEngine} from '#root/modules/ejectionPolicy/services/AutoEjectionEngine.js';
import {DeleteCronService} from '#root/modules/courses/services/deleteCronService.js';
import {initJobs} from '#root/bootstrap/jobs/index.js';
import {AchievementService} from '#root/modules/achievements/services/AchievementService.js';
import {ACHIEVEMENTS_TYPES} from '#root/modules/achievements/types.js';
import {getContainer} from '#root/bootstrap/loadModules.js';

export const startCron = async () => {
  try {
    // Seed achievement definitions (idempotent upsert — safe to run on every startup)
    const achievementService = getContainer().get<AchievementService>(ACHIEVEMENTS_TYPES.AchievementService);
    await achievementService.seedAchievements();

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
  } catch (error) {
    console.error('❌ Failed to initialize delete cron service:', error);
  }
};
