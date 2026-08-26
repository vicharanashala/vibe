import {appConfig} from '#root/config/app.js';
import {getContainer} from '#root/bootstrap/loadModules.js';
import {USERS_TYPES} from '#users/types.js';
import type {EnrollmentService} from '#users/services/EnrollmentService.js';
import cron from 'node-cron';

// Keeps the teacher statistics panel fast.
//
// Of the four figures on that panel, three are counted straight off an indexed
// enrollment query and cost nothing. The fourth — average watch hours — has to
// sum every recorded viewing session for the course version, so its cost grows
// with viewing history rather than with roster size. Computing it per request
// left the panel spinning for seconds on the largest cohorts, and it was
// recomputed on every cold load even though the number barely moves.
//
// This job precomputes that one figure into courseVersionStats; the endpoint
// then reads it with a single indexed lookup. Only versions with active
// students are refreshed, since nothing else has a dashboard to keep warm.
//
// Runs every 15 minutes, so the displayed watch-hours figure trails reality by
// at most that long. The panel shows when it was last computed, so a teacher
// can tell a stale number from a fresh one. Enrollment counts stay live and
// are unaffected. Set ENABLE_ENROLLMENT_STATS_JOB='false' to stop it.
cron.schedule(
  '*/15 * * * *',
  async () => {
    if (!appConfig.ENABLE_ENROLLMENT_STATS_JOB) {
      console.log(
        'Skipped enrollment stats refresh ENABLE_ENROLLMENT_STATS_JOB==',
        appConfig.ENABLE_ENROLLMENT_STATS_JOB,
      );
      return;
    }

    console.log('🚀 Cron Job Started: enrollment stats refresh...');
    try {
      const enrollmentService = getContainer().get<EnrollmentService>(
        USERS_TYPES.EnrollmentService,
      );
      const summary = await enrollmentService.refreshCourseVersionWatchStats();
      console.log(
        `[enrollment-stats] refreshed=${summary.refreshed} ` +
          `failed=${summary.failed}`,
      );
      console.log('🎉 Enrollment stats refresh completed');
    } catch (err) {
      console.error('❌ Enrollment stats refresh failed:', err);
    }
  },
  {
    timezone: 'Asia/Kolkata',
  },
);
