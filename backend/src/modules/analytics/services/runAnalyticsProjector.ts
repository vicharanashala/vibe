import type {Container} from 'inversify';
import {ANALYTICS_TYPES} from '../types.js';
import type {AnalyticsProjector} from './AnalyticsProjector.js';
import type {AnalyticsSourceReader} from '../repositories/AnalyticsSourceReader.js';

export type ProjectorMode = 'refresh' | 'rebuild' | 'backfill';

/**
 * Runs the projector over every course version with active students.
 * `refresh` is incremental (a version never built is built in full),
 * `rebuild` and `backfill` rebuild every active version from scratch.
 */
export async function runAnalyticsProjector(
  container: Container,
  mode: ProjectorMode,
): Promise<{done: number; failed: number}> {
  const source = container.get<AnalyticsSourceReader>(
    ANALYTICS_TYPES.AnalyticsSourceReader,
  );
  const projector = container.get<AnalyticsProjector>(
    ANALYTICS_TYPES.AnalyticsProjector,
  );
  const versions = await source.activeVersions();
  const {done, failed, results} = await projector.refreshAllActive(
    mode === 'refresh' ? 'refresh' : 'rebuild',
    versions,
  );
  const counts: Record<string, number> = {};
  for (const r of results) counts[r.outcome] = (counts[r.outcome] ?? 0) + 1;
  console.log(
    `[analytics] ${mode}: versions=${versions.length} done=${done} ` +
      `failed=${failed} ${JSON.stringify(counts)}`,
  );
  return {done, failed};
}
