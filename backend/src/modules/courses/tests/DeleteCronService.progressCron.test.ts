import {describe, it, expect, vi, beforeEach} from 'vitest';
import cron from 'node-cron';
import {DeleteCronService} from '#root/modules/courses/services/deleteCronService.js';

/**
 * Regression test for the bracing bug in scheduleProgressUpdateCron: the
 * enrollment recompute call previously sat outside the cron.schedule
 * callback, so it ran once on every call to scheduleProgressUpdateCron()
 * (i.e. on every process boot) instead of only when the 3 AM schedule fires.
 *
 * node-cron is mocked so the schedule callback can be invoked directly,
 * without waiting on a real cron tick.
 */

vi.mock('node-cron', () => ({
  default: {schedule: vi.fn()},
}));

function makeService(bulkUpdate: any) {
  const service: any = Object.create(DeleteCronService.prototype);
  service.enrollmentService = {
    bulkUpdateCompletedItemsCountParallelPerCourseVersion: bulkUpdate,
  };
  return service as DeleteCronService;
}

describe('DeleteCronService.scheduleProgressUpdateCron', () => {
  beforeEach(() => {
    (cron.schedule as any).mockClear();
  });

  it('does not run the recompute while merely registering the schedule', () => {
    const bulkUpdate = vi.fn().mockResolvedValue({totalCount: 0, updatedCount: 0});
    const service = makeService(bulkUpdate);

    service.scheduleProgressUpdateCron();

    expect(cron.schedule).toHaveBeenCalledTimes(1);
    expect(cron.schedule).toHaveBeenCalledWith('0 3 * * *', expect.any(Function));
    // The bug this guards against: the recompute used to fire synchronously
    // here, before the schedule ever ticked.
    expect(bulkUpdate).not.toHaveBeenCalled();
  });

  it('runs the recompute only when the scheduled callback fires', async () => {
    const bulkUpdate = vi.fn().mockResolvedValue({totalCount: 5, updatedCount: 3});
    const service = makeService(bulkUpdate);

    service.scheduleProgressUpdateCron();
    const scheduledCallback = (cron.schedule as any).mock.calls[0][1];

    await scheduledCallback();

    expect(bulkUpdate).toHaveBeenCalledTimes(1);
  });

  it('logs and swallows a failure so one bad run does not crash the process', async () => {
    const bulkUpdate = vi.fn().mockRejectedValue(new Error('db unavailable'));
    const service = makeService(bulkUpdate);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    service.scheduleProgressUpdateCron();
    const scheduledCallback = (cron.schedule as any).mock.calls[0][1];

    await expect(scheduledCallback()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });
});
