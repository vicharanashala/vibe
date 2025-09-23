import {ItemRepository} from '#root/shared/database/providers/mongo/repositories/ItemRepository.js';
import {ClientSession, ObjectId} from 'mongodb';
import {
  getFromContainer,
  NotFoundError,
  BadRequestError,
} from 'routing-controllers';
import {Item, Module, Section} from '../classes/index.js';

const itemRepo = getFromContainer(ItemRepository);

export const cloneModules = async (
  existingModules: Module[],
  versionId: string,
  session?: ClientSession,
): Promise<Module[]> => {
  //1 Validate inputs
  if (!Array.isArray(existingModules)) {
    throw new BadRequestError('existingModules must be an array of Module');
  }
  if (!versionId) {
    throw new BadRequestError('versionId is required');
  }

  //2 Prepare array for new modules
  const newModules: Module[] = [];

  //3 Iterate over each module
  for (const module of existingModules) {
    const newModuleId = new ObjectId();
    const newSections: Section[] = [];

    //4 Iterate over each section inside the module
    for (const section of module.sections) {
      const newSectionId = new ObjectId();

      //5 Read old item group for this section
      if (!section.itemsGroupId) {
        throw new BadRequestError(
          `Section ${section.sectionId} missing itemsGroupId`,
        );
      }
      const oldItemGroup = await itemRepo.readItemsGroup(
        section.itemsGroupId.toString(),
        session,
      );
      if (!oldItemGroup) throw new NotFoundError('ItemGroup not found');

      //6 Fetch full item documents for all items inside the item group
      const fullItems: Item[] = [];
      for (const itemRef of oldItemGroup.items) {
        const itemDoc = await itemRepo.readItem(
          versionId,
          itemRef._id.toString(),
        );
        if (!itemDoc) throw new NotFoundError(`Item ${itemRef._id} not found`);
        fullItems.push(itemDoc);
      }

      //7 Clone item docs with no _id so we can insert as new items
      const clonedItems = fullItems.map(itemDoc => ({
        ...itemDoc,
        _id: undefined,
      }));

      //8 Create new items in their respective collections
      const createdItems = await itemRepo.createItems(clonedItems, session);

      //9 Build new item group items referencing newly created items
      const newItemGroupItems = oldItemGroup.items.map((itemRef, idx) => ({
        ...itemRef,
        _id: new ObjectId(createdItems[idx]._id.toString()),
      }));

      //10 Create new item group document for this section
      const newItemGroupData = {
        sectionId: newSectionId,
        items: newItemGroupItems,
      };
      const newItemGroup = await itemRepo.createItemsGroup(
        newItemGroupData,
        session,
      );

      //11 Push cloned section info with new sectionId and new itemGroupId
      newSections.push({
        ...section,
        sectionId: newSectionId,
        itemsGroupId: new ObjectId(newItemGroup._id.toString()),
      });
    }

    //12 Push cloned module info with new moduleId and cloned sections
    newModules.push({
      ...module,
      moduleId: newModuleId,
      sections: newSections,
    });
  }

  //13 Return cloned modules array
  return newModules;
};
