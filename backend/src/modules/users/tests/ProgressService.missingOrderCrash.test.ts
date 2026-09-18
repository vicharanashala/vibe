import {describe, it, expect} from 'vitest';
import {ProgressService} from '#users/services/ProgressService.js';

/**
 * Probes whether getAllItemIds/getItemIdsUntilItem's new sort-by-order
 * logic handles a module/section/item that is missing its `order` field
 * (legacy data created before this field existed, or a partial document
 * from an incomplete migration). The codebase's own canonical sort
 * (CourseVersionService.sortItemsByOrder) defends against exactly this
 * with `a.order || ''` before calling localeCompare. This PR's new sort
 * code calls `a.order.localeCompare(b.order)` directly with no such
 * fallback.
 */

const VERSION_ID = 'version-1';

function makeService() {
  const service: any = Object.create(ProgressService.prototype);

  service.courseRepo = {
    readVersion: async () => ({
      _id: VERSION_ID,
      modules: [
        {
          moduleId: 'module-A',
          order: '0',
          sections: [
            {sectionId: 'section-A1', order: '0', itemsGroupId: 'group-A1'},
          ],
        },
      ],
    }),
  };

  service.itemRepo = {
    readItemsGroup: async () => ({
      items: [
        {_id: 'item-A1-1', order: '0'},
        // Missing `order` entirely -- the realistic legacy-data shape.
        {_id: 'item-A1-2'},
      ],
    }),
  };

  return service as ProgressService;
}

describe('ProgressService item traversal with a missing order field', () => {
  it('getAllItemIds does not crash when an item is missing its order field', async () => {
    const service = makeService();
    let thrown: unknown = null;
    let ids: string[] = [];
    try {
      ids = await service.getAllItemIds(VERSION_ID);
    } catch (err) {
      thrown = err;
    }
    if (thrown) {
      console.log('[missing-order repro] getAllItemIds threw:', (thrown as Error).message);
    }
    expect(thrown).toBeNull();
    expect(ids).toContain('item-A1-1');
    expect(ids).toContain('item-A1-2');
  });

  it('getItemIdsUntilItem does not crash when an item is missing its order field', async () => {
    const service = makeService();
    let thrown: unknown = null;
    try {
      await service.getItemIdsUntilItem(VERSION_ID, 'item-A1-2');
    } catch (err) {
      thrown = err;
    }
    if (thrown) {
      console.log('[missing-order repro] getItemIdsUntilItem threw:', (thrown as Error).message);
    }
    expect(thrown).toBeNull();
  });
});
