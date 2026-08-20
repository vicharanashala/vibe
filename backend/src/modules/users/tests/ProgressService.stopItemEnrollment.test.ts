import {describe, it, expect, vi} from 'vitest';
import {NotFoundError} from 'routing-controllers';
import {ProgressService} from '#users/services/ProgressService.js';

/**
 * Regression test for the silent-success bug in stopItem: when
 * resolveEnrollment came back empty, the transaction callback used to
 * `return` before progressRepository.updateProgress ran. The transaction
 * still committed, so the watchTime row closed in step 1 got a real endTime
 * with no corresponding progress update — a 200 OK to the client with the
 * student's currentItem pointer never advancing.
 *
 * DI is bypassed the same way the other ProgressService unit tests in this
 * module do it (see ProgressService.leaderboard.test.ts and
 * ProgressService.watchTimeRecovery.test.ts): the prototype is instantiated
 * directly and only the collaborators this call path touches are stubbed.
 * validateProgressPositionOrPreviousCompleted and getCourseVersionStatus are
 * left real (their inputs are set up to satisfy them) so this exercises the
 * actual production code path down to the enrollment check, not a mock of it.
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
  });

  service.progressRepository = {
    findProgress: async () => ({
      completed: false,
      // Matches moduleId/sectionId/itemId exactly, so
      // validateProgressPositionOrPreviousCompleted's isExactCurrentItem
      // shortcut applies and the real check passes without needing a
      // previous-item lookup stubbed in.
      currentModule: MODULE_ID,
      currentSection: SECTION_ID,
      currentItem: ITEM_ID,
    }),
    stopItemTracking: async () => ({
      _id: WATCH_ITEM_ID,
      startTime: new Date('2026-08-19T10:00:00Z'),
      endTime: new Date('2026-08-19T10:11:00Z'),
    }),
    getCompletedItems: async () => [],
    getHiddenOrDeletedItems: async () => [],
    updateProgress: vi.fn().mockResolvedValue({completed: false}),
  };

  // The watch-duration / submission eligibility check is exercised by its
  // own tests elsewhere; stubbed here so this test is only about what
  // happens after a session is validly closeable.
  service.validateItemStopEligibility = async () => undefined;

  // Last item in the course, so isCompleted computes true without needing a
  // real course structure walked. A second, uncompleted item keeps the
  // resulting percentage below the >99% threshold that would otherwise
  // trigger stopItem's own call into recalculateStudentProgress — a
  // different code path with its own coverage, not what this test is about.
  service.getNextItemInSequence = async () => null;
  service.getAllItemIds = async () => [ITEM_ID, 'item-2'];

  return service as ProgressService;
}

describe('ProgressService.stopItem — missing enrollment', () => {
  it('throws instead of silently returning, so the transaction rolls back', async () => {
    const service = makeService();
    (service as any).enrollmentRepo = {
      // Both the cohort-scoped and cohort-agnostic fallback lookups inside
      // resolveEnrollment come back empty.
      findEnrollment: async () => null,
    };

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
    ).rejects.toThrow(NotFoundError);

    // The whole point of throwing instead of returning: the transaction
    // aborts before the progress write, rather than committing a closed
    // watchTime with no matching progress update.
    expect(
      (service as any).progressRepository.updateProgress,
    ).not.toHaveBeenCalled();
  });

  it('updates progress normally when the enrollment is found', async () => {
    const service = makeService();
    (service as any).enrollmentRepo = {
      findEnrollment: async () => ({
        _id: 'enrollment-1',
        userId: USER_ID,
        courseId: COURSE_ID,
        courseVersionId: VERSION_ID,
      }),
    };
    (service as any).enrollmentRepo.updateProgressPercentById = vi.fn();

    await service.stopItem(
      USER_ID,
      COURSE_ID,
      VERSION_ID,
      ITEM_ID,
      SECTION_ID,
      MODULE_ID,
      WATCH_ITEM_ID,
    );

    expect(
      (service as any).progressRepository.updateProgress,
    ).toHaveBeenCalledTimes(1);
  });
});
