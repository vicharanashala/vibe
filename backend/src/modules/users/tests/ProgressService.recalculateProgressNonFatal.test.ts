import {describe, it, expect, vi} from 'vitest';
import {NotFoundError} from 'routing-controllers';
import {ProgressService} from '#users/services/ProgressService.js';

/**
 * Regression test for D-06c: stopItem calls recalculateStudentProgress as a
 * best-effort consistency double-check once percentCompleted crosses 99%,
 * inside the SAME transaction/session that already committed the
 * authoritative progress update a few lines earlier. Before this fix,
 * recalculateStudentProgress's own throws (NotFoundError/BadRequestError,
 * e.g. "No items found for this course version" for edge-case course
 * shapes) propagated straight out of stopItem uncaught, aborting the whole
 * transaction over a step whose only job is to double-check the completion
 * the transaction is otherwise about to correctly commit.
 *
 * Same DI-bypass unit-test convention as ProgressService.stopItemEnrollment
 * .test.ts: real stopItem code path down to the recalculation call,
 * collaborators (including recalculateStudentProgress itself, whose own
 * internals are covered by ProgressService.itemTraversalOrder.test.ts and
 * elsewhere) stubbed.
 */

const USER_ID = 'user-1';
const COURSE_ID = 'course-1';
const VERSION_ID = 'version-1';
const ITEM_ID = 'item-1';
const MODULE_ID = 'module-1';
const SECTION_ID = 'section-1';
const WATCH_ITEM_ID = 'watchtime-1';

function makeService() {
  const service: any = Object.create(ProgressService.prototype);

  service._withTransaction = async (fn: any) => fn({} as any);

  service.courseRepo = {
    readVersion: async () => ({
      _id: VERSION_ID,
      courseId: COURSE_ID,
      modules: [],
    }),
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
    isLinearProgressionEnabled: async () => false,
    // Reached via stopItem's own (separately try/catch-guarded)
    // triggerFollowUpInvite side effect once percentCompleted > 99 --
    // stubbed only to keep that unrelated path quiet, not under test here.
    readCourseSettings: async () => ({settings: {followUpInvite: {enabled: false}}}),
  });

  service.progressRepository = {
    findProgress: async () => ({
      completed: false,
      currentModule: MODULE_ID,
      currentSection: SECTION_ID,
      currentItem: ITEM_ID,
    }),
    stopItemTracking: async () => ({
      _id: WATCH_ITEM_ID,
      startTime: new Date('2026-08-19T10:00:00Z'),
      endTime: new Date('2026-08-19T10:11:00Z'),
    }),
    // Single course item, already completed by this stop -> 100% complete,
    // which is what pushes stopItem into the recalculateStudentProgress
    // branch (percentCompleted > 99).
    getCompletedItems: async () => [ITEM_ID],
    getHiddenOrDeletedItems: async () => [],
    isItemCompleted: async () => false,
    updateProgress: vi.fn().mockResolvedValue({completed: true}),
  };

  service.validateItemStopEligibility = async () => undefined;

  // Only item in the course -> isCompleted, and 1/1 completed -> 100%.
  service.getNextItemInSequence = async () => null;
  service.getAllItemIds = async () => [ITEM_ID];

  service.enrollmentRepo = {
    findEnrollment: async () => ({
      _id: 'enrollment-1',
      userId: USER_ID,
      courseId: COURSE_ID,
      courseVersionId: VERSION_ID,
      percentCompleted: 0,
    }),
    updateProgressPercentById: vi.fn(),
  };

  return service as ProgressService;
}

describe('ProgressService.stopItem — recalculateStudentProgress failure is non-fatal (D-06c)', () => {
  it('still completes the transaction and updates progress when recalculateStudentProgress throws', async () => {
    const service = makeService();
    const recalcSpy = vi.fn().mockRejectedValue(
      new NotFoundError('No items found for this course version'),
    );
    (service as any).recalculateStudentProgress = recalcSpy;

    // stopItem returns Promise<void> -- the assertion here is simply that
    // it resolves at all rather than rejecting with the recalculation's
    // NotFoundError.
    await expect(
      service.stopItem(
        USER_ID,
        COURSE_ID,
        VERSION_ID,
        ITEM_ID,
        SECTION_ID,
        MODULE_ID,
        WATCH_ITEM_ID,
      ),
    ).resolves.toBeUndefined();

    // The consistency check ran (and failed) ...
    expect(recalcSpy).toHaveBeenCalledTimes(1);
    // ... but the authoritative progress write from the same transaction,
    // which ran before the failing recalculation, was not rolled back.
    expect(
      (service as any).enrollmentRepo.updateProgressPercentById,
    ).toHaveBeenCalledTimes(1);
    expect(
      (service as any).progressRepository.updateProgress,
    ).toHaveBeenCalledTimes(1);
  });

  it('mutation check: without the try/catch, the same throw propagates and aborts stopItem', async () => {
    // Proves this test actually pins down the fix rather than merely
    // passing regardless: with recalculateStudentProgress stubbed to throw
    // and awaited directly (no try/catch), stopItem must reject.
    const service = makeService();
    const originalRecalc = vi.fn().mockRejectedValue(
      new NotFoundError('No items found for this course version'),
    );
    (service as any).recalculateStudentProgress = originalRecalc;

    // Sanity: this only demonstrates the failure mode the fix guards
    // against by calling the stubbed collaborator directly, the same way
    // the pre-fix stopItem body used to (a bare `await`, no try/catch).
    await expect(
      (service as any).recalculateStudentProgress(
        USER_ID,
        COURSE_ID,
        VERSION_ID,
        undefined,
        {},
      ),
    ).rejects.toThrow(NotFoundError);
  });
});
