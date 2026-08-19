import {appConfig} from '#root/config/app.js';
import {getContainer} from '#root/bootstrap/loadModules.js';
import {USERS_TYPES} from '#users/types.js';
import type {ProgressService} from '#users/services/ProgressService.js';
import cron from 'node-cron';

// Safety net for lost stop calls.
//
// An item counts as complete only if its watchTime row has an endTime, and only
// the stop API writes that field. When the stop call never lands — the network
// drops as the video ends, the tab is closed, the request times out — the row
// stays open, the item never completes, and linear progression locks the
// student out of everything after it. Until this job existed the only remedy
// was editing the database by hand, one student at a time.
//
// The sweep closes such a row at its lastSeenAt heartbeat, but only when the
// resulting duration clears the same isValidWatchTime bar the live stop path
// enforces. Someone who opened a video and walked away fails that check and
// correctly stays incomplete, so no one is handed a completion they did not
// earn and linear progression is not weakened.
//
// Runs every 30 minutes over sessions untouched for at least 30 minutes, which
// is far longer than the 15s heartbeat interval, so a student who is simply
// still watching is never swept. Idempotent, and safe to run concurrently
// across instances: the close is guarded on the row still being open and the
// pointer only moves while it is still parked on the recovered item. Gate with
// ENABLE_WATCHTIME_RECOVERY_JOB=true.
cron.schedule(
  '*/30 * * * *',
  async () => {
    if (!appConfig.ENABLE_WATCHTIME_RECOVERY_JOB) {
      console.log(
        'Skipped orphaned watch-time recovery ENABLE_WATCHTIME_RECOVERY_JOB==',
        appConfig.ENABLE_WATCHTIME_RECOVERY_JOB,
      );
      return;
    }

    console.log('🚀 Cron Job Started: orphaned watch-time recovery...');
    try {
      const progressService = getContainer().get<ProgressService>(
        USERS_TYPES.ProgressService,
      );
      const summary = await progressService.recoverOrphanedWatchTimes();
      console.log(
        `[watchtime-recovery] scanned=${summary.scanned} ` +
          `closed=${summary.closed} advanced=${summary.advanced} ` +
          `rejected=${summary.rejected} skipped=${summary.skipped}`,
      );
      console.log('🎉 Orphaned watch-time recovery completed');
    } catch (err) {
      console.error('❌ Orphaned watch-time recovery failed:', err);
    }
  },
  {
    timezone: 'Asia/Kolkata',
  },
);
