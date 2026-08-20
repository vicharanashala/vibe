import './backupDb.js';
import './allocateHp.js'
import './backfillFollowUpInvites.js';
import './evaluateSlotFulfillment.js';
import './resolveExpiredDuels.js';
import './sweepMatchmaking.js';
import './recoverOrphanedWatchTimes.js';

export const initJobs = () => {
  console.log('[CRON] Jobs initialized.');
};  