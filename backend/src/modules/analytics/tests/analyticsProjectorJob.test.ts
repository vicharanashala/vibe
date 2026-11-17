import {describe, it, expect, vi, beforeEach} from 'vitest';

const scheduled: {expr: string; fn: () => Promise<void>}[] = [];
vi.mock('node-cron', () => ({
  default: {
    schedule: (expr: string, fn: () => Promise<void>) =>
      scheduled.push({expr, fn}),
  },
}));
const run = vi.fn(async () => ({done: 0, failed: 0}));
vi.mock('#root/modules/analytics/services/runAnalyticsProjector.js', () => ({
  runAnalyticsProjector: run,
}));
vi.mock('#root/bootstrap/loadModules.js', () => ({getContainer: () => ({})}));
const appConfig = {ENABLE_ANALYTICS_PROJECTOR_JOB: false};
vi.mock('#root/config/app.js', () => ({appConfig}));

describe('analytics projector cron fallback (4.2)', () => {
  beforeEach(() => run.mockClear());

  it('schedules refresh every 5 minutes and rebuild at 02:30 IST', async () => {
    await import('#root/bootstrap/jobs/analyticsProjector.js');
    expect(scheduled.map(s => s.expr)).toEqual(['*/5 * * * *', '30 2 * * *']);
  });

  it('does nothing when ENABLE_ANALYTICS_PROJECTOR_JOB is false', async () => {
    appConfig.ENABLE_ANALYTICS_PROJECTOR_JOB = false;
    for (const s of scheduled) await s.fn();
    expect(run).not.toHaveBeenCalled();
  });

  it('runs refresh and rebuild when enabled', async () => {
    appConfig.ENABLE_ANALYTICS_PROJECTOR_JOB = true;
    for (const s of scheduled) await s.fn();
    expect(run.mock.calls.map(c => (c as unknown[])[1])).toEqual([
      'refresh',
      'rebuild',
    ]);
  });
});
