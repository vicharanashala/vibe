import {describe, it, expect} from 'vitest';
import {ProgressService} from '#users/services/ProgressService.js';

/**
 * Regression test for D-06b: getItemIdsUntilItem/getAllItemIds walked
 * modules/sections/items in raw array (insertion) order instead of sorting
 * by the `order` field first, unlike every other traversal in this
 * codebase (CourseVersionService.sortItemsByOrder and its call sites).
 *
 * After a drag-drop reorder in the course editor, a module/section/item's
 * position in the stored array no longer matches its display position --
 * only `order` (a lexicographically-sortable string) does. This test
 * deliberately stores things in an array order that DISAGREES with
 * `order`, so it fails if the traversal ever regresses back to raw
 * array order.
 */

const VERSION_ID = 'version-1';

function makeService() {
  const service: any = Object.create(ProgressService.prototype);

  // Two modules stored in reverse of their real (order-field) sequence.
  service.courseRep = undefined;
  service.courseRepo = {
    readVersion: async () => ({
      _id: VERSION_ID,
      modules: [
        {
          moduleId: 'module-B',
          order: '1',
          sections: [
            {sectionId: 'section-B1', order: '0', itemsGroupId: 'group-B1'},
          ],
        },
        {
          moduleId: 'module-A',
          order: '0',
          sections: [
            // Two sections stored out of order too.
            {sectionId: 'section-A2', order: '1', itemsGroupId: 'group-A2'},
            {sectionId: 'section-A1', order: '0', itemsGroupId: 'group-A1'},
          ],
        },
      ],
    }),
  };

  service.itemRepo = {
    readItemsGroup: async (groupId: string) => {
      const groups: Record<string, any> = {
        'group-A1': {
          items: [
            {_id: 'item-A1-2', order: '1'},
            {_id: 'item-A1-1', order: '0'},
          ],
        },
        'group-A2': {
          items: [{_id: 'item-A2-1', order: '0'}],
        },
        'group-B1': {
          items: [{_id: 'item-B1-1', order: '0'}],
        },
      };
      return groups[groupId];
    },
  };

  return service as ProgressService;
}

describe('ProgressService item traversal order (D-06b)', () => {
  it('getAllItemIds returns items in display order (by `order`), not array/insertion order', async () => {
    const service = makeService();
    const ids = await service.getAllItemIds(VERSION_ID);

    expect(ids).toEqual([
      'item-A1-1',
      'item-A1-2',
      'item-A2-1',
      'item-B1-1',
    ]);
  });

  it('getItemIdsUntilItem stops at the target item\'s true display position, not its array position', async () => {
    const service = makeService();

    // item-A2-1 is stored (array position) before module-A's items even
    // though it's logically item-A2-1 -- module-A comes first by `order`,
    // and within it section-A1 (order '0') comes before section-A2
    // (order '1'). The correct "everything up to and including
    // item-A2-1" set is therefore the two section-A1 items plus item-A2-1
    // itself -- nothing from module-B, regardless of array position.
    const ids = await service.getItemIdsUntilItem(VERSION_ID, 'item-A2-1');

    expect(ids).toEqual(['item-A1-1', 'item-A1-2', 'item-A2-1']);
  });

  it('getItemIdsUntilItem for the very first item by order returns only that item', async () => {
    const service = makeService();
    const ids = await service.getItemIdsUntilItem(VERSION_ID, 'item-A1-1');
    expect(ids).toEqual(['item-A1-1']);
  });
});
