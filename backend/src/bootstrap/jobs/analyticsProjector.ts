import cron from 'node-cron';
import {appConfig} from '#root/config/app.js';
import {getContainer} from '#root/bootstrap/loadModules.js';
import {runAnalyticsProjector} from '#root/modules/analytics/services/runAnalyticsProjector.js';

/**
 * In-process fallback for the course analytics projector. Production runs
 * the projector as a Cloud Run Job instead (backend/docs/analytics-projector.md):
 * node-cron only fires while a CPU-throttled Cloud Run instance happens to be
 * awake, and a full rebuild doesn't belong on an instance serving students.
 * Gated by ENABLE_ANALYTICS_PROJECTOR_JOB (off in production/staging by default).
 */
export function scheduleAnalyticsProjector(): void {
  const run = (mode: 'refresh' | 'rebuild') => async () => {
    if (!appConfig.ENABLE_ANALYTICS_PROJECTOR_JOB) return;
    try {
      await runAnalyticsProjector(getContainer(), mode);
    } catch (err) {
      console.error(`[analytics] scheduled ${mode} failed:`, err);
    }
  };
  cron.schedule('*/5 * * * *', run('refresh'), {timezone: 'Asia/Kolkata'});
  cron.schedule('30 2 * * *', run('rebuild'), {timezone: 'Asia/Kolkata'});
}

scheduleAnalyticsProjector();
