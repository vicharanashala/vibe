import {describe, it, expect, vi} from 'vitest';
import {BadRequestError, NotFoundError} from 'routing-controllers';
import {ProgressService} from '#users/services/ProgressService.js';

/**
 * Unit tests for the admin-only "unstick a student" path added for #1295.
 *
 * DI is bypassed the same way the other ProgressService unit tests in this
 * module do it: the prototype is instantiated directly and only the
 * collaborators this call path touches are stubbed. advanceProgressAfterItemCompletion
 * itself is left real (not stubbed) so this exercises the actual production
 * wiring between adminAdvanceStuckStudent and the shared advance helper, not
 * a mock of it.
 */

const USER_ID = 'user-1';
const COURSE_ID = 'course-1';
const VERSION_ID = 'version-1';
const ITEM_ID = 'item-1';
const MODULE_ID = 'module-1';
const SECTION_ID = 'section-1';
const ADMIN_ID = 'admin-1';

function makeService(overrides: {progressCompleted?: boolean} = {}) {
  const service: any = Object.create(ProgressService.prototype);

  service._withTransaction = async (fn: any) => fn({} as any);

  const recordAdminSkip = vi.fn();
  const updateProgress = vi.fn().mockResolvedValue({completed: false});

  service.progressRepository = {
    findProgress: async () => ({
      completed: overrides.progressCompleted ?? false,
      currentModule: MODULE_ID,
      currentSection: SECTION_ID,
      currentItem: ITEM_ID,
    }),
    recordAdminSkip,
    getCompletedItems: async () => [],
    getHiddenOrDeletedItems: async () => [],
    updateProgress,
  };

  service.courseRepo = {
    readVersion: async () => ({
      _id: VERSION_ID,
      courseId: COURSE_ID,
      modules: [],
    }),
  };

  service.enrollmentRepo = {
    updateProgressPercentById: vi.fn(),
  };

  service.resolveEnrollment = async () => ({_id: 'enrollment-1'});
  service.getNextItemInSequence = async () => ({
    moduleId: MODULE_ID,
    sectionId: SECTION_ID,
    itemId: 'item-2',
    completed: false,
  });
  service.getAllItemIds = async () => [ITEM_ID, 'item-2'];

  return {service: service as ProgressService, recordAdminSkip, updateProgress};
}

describe('ProgressService.adminAdvanceStuckStudent', () => {
  it('records the skip and advances currentItem past the stuck item', async () => {
    const {service, recordAdminSkip, updateProgress} = makeService();

    const result = await service.adminAdvanceStuckStudent(
      USER_ID,
      COURSE_ID,
      VERSION_ID,
      'Stop call lost, confirmed watched via ticket #123',
      ADMIN_ID,
    );

    expect(result).toBe(true);

    expect(recordAdminSkip).toHaveBeenCalledTimes(1);
    const [, , , skip] = recordAdminSkip.mock.calls[0];
    expect(skip).toMatchObject({
      itemId: ITEM_ID,
      reason: 'Stop call lost, confirmed watched via ticket #123',
      skippedBy: ADMIN_ID,
    });

    expect(updateProgress).toHaveBeenCalledTimes(1);
    const [, , , newProgress] = updateProgress.mock.calls[0];
    // Moved past the stuck item — not marked as its completion, just relocated.
    expect(newProgress).toMatchObject({currentItem: 'item-2'});
  });

  it('refuses to advance a student who has already completed the course', async () => {
    const {service, recordAdminSkip} = makeService({progressCompleted: true});

    await expect(
      service.adminAdvanceStuckStudent(
        USER_ID,
        COURSE_ID,
        VERSION_ID,
        'irrelevant',
        ADMIN_ID,
      ),
    ).rejects.toThrow(BadRequestError);

    expect(recordAdminSkip).not.toHaveBeenCalled();
  });

  it('404s when there is no progress record for this student', async () => {
    const service: any = Object.create(ProgressService.prototype);
    service._withTransaction = async (fn: any) => fn({} as any);
    service.progressRepository = {findProgress: async () => null};

    await expect(
      service.adminAdvanceStuckStudent(
        USER_ID,
        COURSE_ID,
        VERSION_ID,
        'irrelevant',
        ADMIN_ID,
      ),
    ).rejects.toThrow(NotFoundError);
  });
});
