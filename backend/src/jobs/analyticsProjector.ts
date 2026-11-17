/**
 * Course analytics projector, run as its own process (a Cloud Run Job in
 * production, triggered by Cloud Scheduler) so the work stays off the
 * instances serving students. See backend/docs/analytics-projector.md.
 *
 *   node build/jobs/analyticsProjector.js refresh    # every 5 minutes
 *   node build/jobs/analyticsProjector.js rebuild    # nightly
 *   node build/jobs/analyticsProjector.js backfill   # once, after first deploy
 *
 * Exits non-zero if any course version failed.
 */
import 'reflect-metadata';
// Same import prelude as src/index.ts: loading the shared barrel first lets the
// container's import cycle settle before sharedContainerModule is read.
import '#root/shared/index.js';
import {Container} from 'inversify';
import {sharedContainerModule} from '#root/container.js';
import {analyticsContainerModule} from '#root/modules/analytics/container.js';
import {
  runAnalyticsProjector,
  ProjectorMode,
} from '#root/modules/analytics/services/runAnalyticsProjector.js';
import {GLOBAL_TYPES} from '#root/types.js';
import type {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';

const MODES: ProjectorMode[] = ['refresh', 'rebuild', 'backfill'];

async function main(): Promise<number> {
  const mode = process.argv[2] as ProjectorMode;
  if (!MODES.includes(mode)) {
    console.error(`usage: analyticsProjector.js <${MODES.join('|')}>`);
    return 2;
  }
  // Only the database and the analytics module: no HTTP server, no cron jobs.
  const container = new Container();
  await container.load(sharedContainerModule, analyticsContainerModule);
  const db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
  await db.connect();
  try {
    const {failed} = await runAnalyticsProjector(container, mode);
    return failed ? 1 : 0;
  } finally {
    await db.disconnect?.();
  }
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('[analytics] projector crashed:', err);
    process.exit(1);
  });
