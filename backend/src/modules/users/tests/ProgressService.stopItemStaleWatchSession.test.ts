import {describe, it, expect, vi} from 'vitest';
import {BadRequestError} from 'routing-controllers';
import {ProgressService} from '#users/services/ProgressService.js';

/**
 * Regression test for students stuck after a refresh. The client can send a
 * stale watchItemId (the course store keeps it in localStorage). When no open
 * session matched, stopItem used to assume a concurrent stop had finished the
 * item and return 200 — the item never completed, the client moved on, and
 * the next lesson was refused until progress was reset by hand.
 *
 * Collaborators are stubbed the same way as
 * ProgressService.stopItemEnrollment.test.ts.
 */

const USER_ID = 'user-1';
const COURSE_ID = 'course-1';
const VERSION_ID = 'version-1';
const ITEM_ID = 'item-1';
const MODULE_ID = 'module-1';
const SECTION_ID = 'section-1';
const STALE_WATCH_ITEM_ID = 'watchtime-from-before-refresh';

function makeService({
  closedSession,
  completedMeanwhile,
}: {
  closedSession: unknown;
  completedMeanwhile: boolean;
}) {
  const service: any = Object.create(ProgressService.prototype);

  service._withTransaction = async (fn: any) => fn({} as any);
  service.courseRepo = {
    readVersion: async () => ({_id: VERSION_ID, courseId: COURSE_ID, modules: []}),
    getCourseVersionStatus: async () => 'active',
  };
  service.itemRepo = {
    readItemById: async () => ({
      _id: ITEM_ID,
      type: 'VIDEO',
      details: {startTime: '00:00:00', endTime: '00:10:00'},
    }),
  };
  service.getCourseSettingService = () => ({
    isLinearProgressionEnabled: async () => true,
  });

  // The first call is stopItem's idempotency guard (not complete yet); the
  // second is the re-check after no open session was found.
  const isItemCompleted = vi
    .fn()
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(completedMeanwhile);

  service.progressRepository = {
    findProgress: async () => ({
      completed: false,
      currentModule: MODULE_ID,
      currentSection: SECTION_ID,
      currentItem: ITEM_ID,
    }),
    isItemCompleted,
    stopItemTrackingForItem: vi.fn().mockResolvedValue(closedSession),
    getCompletedItems: async () => [],
    getHiddenOrDeletedItems: async () => [],
    updateProgress: vi.fn().mockResolvedValue({completed: false}),
  };
  service.enrollmentRepo = {
    findEnrollment: async () => ({_id: 'enrollment-1'}),
    updateProgressPercentById: vi.fn(),
  };
  service.validateItemStopEligibility = async () => undefined;
  service.getNextItemInSequence = async () => ({
    moduleId: MODULE_ID,
    sectionId: SECTION_ID,
    itemId: 'item-2',
  });
  service.getAllItemIds = async () => [ITEM_ID, 'item-2'];

  return service;
}

function stop(service: any) {
  return service.stopItem(
    USER_ID,
    COURSE_ID,
    VERSION_ID,
    ITEM_ID,
    SECTION_ID,
    MODULE_ID,
    STALE_WATCH_ITEM_ID,
  );
}

describe('ProgressService.stopItem — stale watchItemId after a refresh', () => {
  it('looks the session up by student and item, not by the client id alone', async () => {
    const service = makeService({
      closedSession: {
        _id: 'watchtime-after-refresh',
        startTime: new Date('2026-10-12T10:00:00Z'),
        endTime: new Date('2026-10-12T10:11:00Z'),
      },
      completedMeanwhile: false,
    });

    await stop(service);

    expect(service.progressRepository.stopItemTrackingForItem).toHaveBeenCalledWith(
      STALE_WATCH_ITEM_ID,
      USER_ID,
      COURSE_ID,
      VERSION_ID,
      ITEM_ID,
      undefined,
      expect.anything(),
    );
    expect(service.progressRepository.updateProgress).toHaveBeenCalledTimes(1);
  });

  it('fails instead of reporting success when nothing was completed', async () => {
    const service = makeService({closedSession: null, completedMeanwhile: false});

    await expect(stop(service)).rejects.toThrow(BadRequestError);
    expect(service.progressRepository.updateProgress).not.toHaveBeenCalled();
  });

  it('still succeeds when a concurrent stop completed the item', async () => {
    const service = makeService({closedSession: null, completedMeanwhile: true});

    await expect(stop(service)).resolves.toBeUndefined();
    expect(service.progressRepository.updateProgress).not.toHaveBeenCalled();
  });
});
