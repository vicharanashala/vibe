import { appConfig } from '#root/config/app.js';
import { getContainer } from '#root/bootstrap/loadModules.js';
import { SETTING_TYPES } from '#root/modules/setting/types.js';
import { USERS_TYPES } from '#users/types.js';
import type { CourseSettingService } from '#root/modules/setting/index.js';
import type { ProgressService } from '#users/services/ProgressService.js';
import cron from 'node-cron';

// Daily reconciliation safety net for follow-up invites.
//
// The follow-up invite is primarily created in real time when a student crosses
// the >=98% threshold (see ProgressService.stopItem). This job is a backstop
// that catches stragglers the live trigger can miss: progress moved via
// skip/recalculate/bulk paths, best-effort invite failures, or students who
// crossed the threshold before the feature was enabled. It re-runs the same
// threshold-based backfill, which is idempotent (InviteService de-dupes pending
// invites and skips already-enrolled users), so repeated runs are safe.
//
// Runs daily at 02:30 IST. Gate with ENABLE_FOLLOWUP_INVITE_JOB=true.
cron.schedule(
  '30 2 * * *',
  async () => {
    if (!appConfig.ENABLE_FOLLOWUP_INVITE_JOB) {
      console.log(
        'Skipped follow-up invite backfill ENABLE_FOLLOWUP_INVITE_JOB==',
        appConfig.ENABLE_FOLLOWUP_INVITE_JOB,
      );
      return;
    }

    console.log('🚀 Cron Job Started: Follow-up invite reconciliation...');
    try {
      const courseSettingService = getContainer().get<CourseSettingService>(
        SETTING_TYPES.SettingRepo,
      );
      const progressService = getContainer().get<ProgressService>(
        USERS_TYPES.ProgressService,
      );

      const sources =
        await courseSettingService.getCourseVersionsWithFollowUpInviteEnabled();
      console.log(
        `[follow-up] ${sources.length} source course version(s) with follow-up invite enabled`,
      );

      for (const {courseId, courseVersionId} of sources) {
        try {
          const summary = await progressService.backfillFollowUpInvites(
            courseId,
            courseVersionId,
          );
          console.log(
            `[follow-up] ${courseId}/${courseVersionId} → ` +
              `eligible=${summary.completed} alreadyEnrolled=${summary.alreadyEnrolled} ` +
              `missingEmail=${summary.missingEmail} invited=${summary.invited}`,
          );
        } catch (err) {
          // One bad source must not stop the rest.
          console.error(
            `[follow-up] Backfill failed for ${courseId}/${courseVersionId}:`,
            err,
          );
        }
      }
      console.log('🎉 Follow-up invite reconciliation completed');
    } catch (err) {
      console.error('❌ Follow-up invite reconciliation failed:', err);
    }
  },
  {
    timezone: 'Asia/Kolkata',
  },
);
