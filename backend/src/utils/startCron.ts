import { getFromContainer } from 'routing-controllers';
import { DeleteCronService } from '#root/modules/courses/services/deleteCronService.js';

export const startCron = () => {
  try {
    // Get DeleteCronService from the existing container and schedule it
    const deleteCronService = getFromContainer(DeleteCronService);
    deleteCronService.scheduleDeleteCron();
    deleteCronService.scheduleBulkUpdateProgress();

    console.log('✅ Delete cron job scheduled successfully');
  } catch (error) {
    console.error('❌ Failed to initialize delete cron service:', error);
  }
};
