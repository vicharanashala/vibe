import {describe, it, expect} from 'vitest';
import {ObjectId} from 'mongodb';
import {BadRequestError} from 'routing-controllers';
import {ProgressService} from '#users/services/ProgressService.js';

/**
 * #1393's verifyProgress fallback checks only the ONE item immediately
 * before the requested one (mirroring ItemService._isPreviousItemCompleted
 * exactly). This is a real, reviewer-raised question: if a student's pointer
 * is two items behind the one they're retrying (item1), and they have an
 * open/attempted row on item3 -- skipping item2 entirely -- does the
 * single-hop check correctly identify item2 (not completed) as the blocker,
 * rather than only checking against the pointer's own position (item1)?
 *
 * It should, since getPreviousItemInSequence(item3) resolves to item2
 * regardless of where the pointer actually is -- the check is relative to
 * the requested item, not the pointer. This locks that in.
 */
describe('ProgressService.verifyProgress -- pointer two items behind the requested item', () => {
  function buildService(opts: {item2Completed: boolean}) {
    const service: any = Object.create(ProgressService.prototype);

    const userId = new ObjectId().toString();
    const courseId = new ObjectId().toString();
    const courseVersionId = new ObjectId().toString();
    const moduleId = new ObjectId().toString();
    const sectionId = new ObjectId().toString();
    const itemsGroupId = new ObjectId().toString();
    const item1 = new ObjectId().toString();
    const item2 = new ObjectId().toString();
    const item3 = new ObjectId().toString();

    service.progressRepository = {
      findProgress: async () => ({
        currentModule: moduleId,
        currentSection: sectionId,
        // Pointer is on item1 -- two items behind item3, the one being retried.
        currentItem: item1,
      }),
      isItemCompleted: async (
        _u: string,
        _c: string,
        _v: string,
        checkedItemId: string,
      ) => {
        if (checkedItemId === item3) return false; // not completed -- keep going
        if (checkedItemId === item2) return opts.item2Completed;
        return false;
      },
    };

    service.getCourseSettingService = () => ({
      isLinearProgressionEnabled: async () => true,
    });

    service.itemRepo = {
      readItemsGroup: async () => ({
        items: [
          {_id: item1, order: 'a', isHidden: false, isDeleted: false},
          {_id: item2, order: 'b', isHidden: false, isDeleted: false},
          {_id: item3, order: 'c', isHidden: false, isDeleted: false},
        ],
      }),
    };

    service.courseRepo = {
      readVersion: async () => ({
        modules: [
          {
            moduleId,
            order: 'a',
            sections: [{sectionId, order: 'a', itemsGroupId}],
          },
        ],
      }),
    };

    return {service, userId, courseId, courseVersionId, moduleId, sectionId, item3};
  }

  it('rejects starting item3 when item2 (the actual predecessor) was skipped and never completed', async () => {
    const {service, userId, courseId, courseVersionId, moduleId, sectionId, item3} =
      buildService({item2Completed: false});

    await expect(
      service.verifyProgress(userId, courseId, courseVersionId, moduleId, sectionId, item3),
    ).rejects.toThrow(BadRequestError);
  });

  it('admits starting item3 once item2 (the actual predecessor) is genuinely completed', async () => {
    const {service, userId, courseId, courseVersionId, moduleId, sectionId, item3} =
      buildService({item2Completed: true});

    await expect(
      service.verifyProgress(userId, courseId, courseVersionId, moduleId, sectionId, item3),
    ).resolves.toBeUndefined();
  });
});
