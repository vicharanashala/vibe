import './backupDb.js';
import './allocateHp.js'
import './backfillFollowUpInvites.js';
import './evaluateSlotFulfillment.js';

export const initJobs = () => {
  console.log('[CRON] Jobs initialized.');
};  