import {describe, it, expect} from 'vitest';
import {ObjectId} from 'mongodb';
import {ProgressService} from '#users/services/ProgressService.js';

/**
 * getPreviousItemInSequence sorts modules/sections/items with raw
 * `a.order.localeCompare(b.order)`, which throws "Cannot read properties of
 * undefined (reading 'localeCompare')" for a legacy/partially-migrated
 * document missing `order` -- the same class of bug #1402 found and fixed
 * for a different sort in this file (CourseVersionService.sortItemsByOrder's
 * `a.order || ''` guard is the canonical fix already used elsewhere).
 *
 * #1393 makes this function newly reachable from startItem's hot path (the
 * whole point of that PR is unsticking deadlocked students), so a legacy
 * course crashing here would 500 exactly the students that fix exists for,
 * instead of the clean 400 the strict-match code used to return.
 */
describe('ProgressService.getPreviousItemInSequence -- missing order field', () => {
  it('does not throw when an item in the sequence is missing its order field, and still finds the right predecessor', async () => {
    const service: any = Object.create(ProgressService.prototype);
    const moduleId = new ObjectId().toString();
    const sectionId = new ObjectId().toString();
    const itemId = new ObjectId().toString();
    const itemsGroupId = new ObjectId().toString();
    const previousItemId = new ObjectId().toString();

    service.itemRepo = {
      readItemsGroup: async () => ({
        items: [
          {_id: itemId, order: 'b', isHidden: false, isDeleted: false},
          // order deliberately missing -- legacy/partially-migrated document.
          // Sorts as '' under the `|| ''` guard, i.e. before 'b', so this is
          // the correct predecessor of itemId.
          {_id: previousItemId, isHidden: false, isDeleted: false},
        ],
      }),
    };

    const courseVersion: any = {
      modules: [
        {moduleId, order: 'a', sections: [{sectionId, order: 'a', itemsGroupId}]},
        {moduleId: new ObjectId().toString(), order: 'b', sections: []},
      ],
    };

    const previous = await service.getPreviousItemInSequence(
      courseVersion,
      moduleId,
      sectionId,
      itemId,
    );

    expect(previous?.itemId).toBe(previousItemId);
  });
});
