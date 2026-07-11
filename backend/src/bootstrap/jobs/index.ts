import './backupDb.js';
import './allocateHp.js'
import './backfillFollowUpInvites.js';
import './evaluateSlotFulfillment.js';
import './peerReviewCrons.js';

export const initJobs = () => {
  console.log('[CRON] Jobs initialized.');
};