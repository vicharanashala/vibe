import {describe, it, expect} from 'vitest';
import {ObjectId} from 'mongodb';
import {ProgressService} from '#users/services/ProgressService.js';

/**
 * getPreviousItemInSequence indexes into module/section/item arrays with
 * `arr?.[i].prop` in several places -- the `?.` only guards the array itself
 * being nullish, not the result of an out-of-bounds index (`arr[i]` on an
 * empty array is `undefined`, a normal value, not a nullish base the `?.`
 * short-circuits on) -- so `.prop` right after still throws on an empty
 * array. Two of the six sorts in this function had this gap; a third
 * (isFirstItem && !isFirstSection branch) was already correctly guarded with
 * `?.`/`|| ''`, which is what these fixes now match.
 *
 * Both are real, reachable authoring-time states: a module with zero
 * sections right after creation (ModuleService.createModule's own "previous
 * module has no sections" guard confirms this happens), and a section whose
 * items group has zero items (created but not yet populated) -- both can
 * exist on a course that already has enrolled, actively-progressing
 * students, since #1393 makes this function reachable from startItem's hot
 * path for any mismatched-pointer retry, not just freshly-authored courses.
 */
describe('ProgressService.getPreviousItemInSequence -- empty sections/items arrays', () => {
  it('does not throw when the current module has zero sections', async () => {
    const service: any = Object.create(ProgressService.prototype);
    const moduleId = new ObjectId().toString();
    const sectionId = new ObjectId().toString();
    const itemId = new ObjectId().toString();

    service.itemRepo = {readItemsGroup: async () => ({items: []})};

    const courseVersion: any = {
      modules: [
        {moduleId, order: 'a', sections: []}, // zero sections
        {moduleId: new ObjectId().toString(), order: 'b', sections: []},
      ],
    };

    const result = await service.getPreviousItemInSequence(
      courseVersion,
      moduleId,
      sectionId,
      itemId,
    );
    expect(result).toEqual({moduleId, sectionId: '', itemId: ''});
  });

  it('does not throw when the previous module\'s last section has zero items, and returns an empty itemId instead of crashing', async () => {
    const service: any = Object.create(ProgressService.prototype);
    const prevModuleId = new ObjectId().toString();
    const prevSectionId = new ObjectId().toString();
    const prevItemsGroupId = new ObjectId().toString();
    const currentModuleId = new ObjectId().toString();
    const currentSectionId = new ObjectId().toString();
    const currentItemsGroupId = new ObjectId().toString();
    const itemId = new ObjectId().toString(); // the only/first item in the current module

    service.itemRepo = {
      readItemsGroup: async (groupId: string) => {
        if (groupId === prevItemsGroupId) return {items: []}; // zero items -- the crash trigger
        return {items: [{_id: itemId, order: 'a', isHidden: false, isDeleted: false}]};
      },
    };

    const courseVersion: any = {
      modules: [
        {
          moduleId: prevModuleId,
          order: 'a',
          sections: [{sectionId: prevSectionId, order: 'a', itemsGroupId: prevItemsGroupId}],
        },
        {
          moduleId: currentModuleId,
          order: 'b',
          sections: [{sectionId: currentSectionId, order: 'a', itemsGroupId: currentItemsGroupId}],
        },
      ],
    };

    const result = await service.getPreviousItemInSequence(
      courseVersion,
      currentModuleId,
      currentSectionId,
      itemId,
    );

    expect(result).toEqual({
      moduleId: prevModuleId,
      sectionId: prevSectionId,
      itemId: '',
    });
  });
});
