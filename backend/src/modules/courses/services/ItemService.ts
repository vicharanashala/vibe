import {Service, Inject} from 'typedi';
import {InternalServerError, NotFoundError} from 'routing-controllers';
import {IItemRepository} from 'shared/database';
import {ICourseRepository} from 'shared/database/';
import {Item} from '../classes/transformers/Item';
import {
  CreateItemBody,
  UpdateItemBody,
  MoveItemBody,
} from '../classes/validators/ItemValidators';
import {calculateNewOrder} from '../utils/calculateNewOrder';
import {ReadConcern, ReadPreference, WriteConcern} from 'mongodb';

@Service()
export class ItemService {
  constructor(
    @Inject('ItemRepo')
    private readonly itemRepo: IItemRepository,
    @Inject('CourseRepo')
    private readonly courseRepo: ICourseRepository,
  ) {}

  public async createItem(
    versionId: string,
    moduleId: string,
    sectionId: string,
    body: CreateItemBody,
  ) {
    const client = await this.courseRepo.getDBClient();
    const session = client.startSession();
    const txOptions = {
      readPreference: ReadPreference.primary,
      readConcern: new ReadConcern('snapshot'),
      writeConcern: new WriteConcern('majority'),
    };

    try {
      await session.startTransaction(txOptions);

      const version = await this.courseRepo.readVersion(versionId, session);
      if (!version) throw new NotFoundError(`Version ${versionId} not found.`);
      const module = version.modules.find(m => m.moduleId === moduleId)!;
      const section = module.sections.find(s => s.sectionId === sectionId)!;

      const itemsGroup = await this.itemRepo.readItemsGroup(
        section.itemsGroupId.toString(),
        session,
      );

      const newItem = new Item(body, itemsGroup.items);
      itemsGroup.items.push(newItem);
      section.updatedAt = new Date();
      module.updatedAt = new Date();
      version.updatedAt = new Date();

      const updatedItemsGroup = await this.itemRepo.updateItemsGroup(
        section.itemsGroupId.toString(),
        itemsGroup,
        session,
      );
      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        version,
      );

      await session.commitTransaction();
      return {itemsGroup: updatedItemsGroup, version: updatedVersion};
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  public async readAllItems(
    versionId: string,
    moduleId: string,
    sectionId: string,
  ) {
    const version = await this.courseRepo.readVersion(versionId);
    const module = version.modules.find(m => m.moduleId === moduleId)!;
    const section = module.sections.find(s => s.sectionId === sectionId)!;
    return this.itemRepo.readItemsGroup(section.itemsGroupId.toString());
  }

  public async updateItem(
    versionId: string,
    moduleId: string,
    sectionId: string,
    itemId: string,
    body: UpdateItemBody,
  ) {
    const client = await this.courseRepo.getDBClient();
    const session = client.startSession();
    const txOptions = {
      readPreference: ReadPreference.primary,
      readConcern: new ReadConcern('snapshot'),
      writeConcern: new WriteConcern('majority'),
    };

    try {
      await session.startTransaction(txOptions);

      const version = await this.courseRepo.readVersion(versionId, session);
      if (!version) throw new NotFoundError(`Version ${versionId} not found.`);
      const module = version.modules.find(m => m.moduleId === moduleId)!;
      const section = module.sections.find(s => s.sectionId === sectionId)!;
      const itemsGroup = await this.itemRepo.readItemsGroup(
        section.itemsGroupId.toString(),
        session,
      );

      const item = itemsGroup.items.find(i => i.itemId.toString() === itemId)!;
      Object.assign(item, body);
      section.updatedAt = new Date();
      module.updatedAt = new Date();
      version.updatedAt = new Date();

      const updatedItemsGroup = await this.itemRepo.updateItemsGroup(
        section.itemsGroupId.toString(),
        itemsGroup,
        session,
      );
      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        version,
      );

      await session.commitTransaction();
      return {itemsGroup: updatedItemsGroup, version: updatedVersion};
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  public async deleteItem(itemsGroupId: string, itemId: string) {
    const client = await this.courseRepo.getDBClient();
    const session = client.startSession();
    const txOptions = {
      readPreference: ReadPreference.primary,
      readConcern: new ReadConcern('snapshot'),
      writeConcern: new WriteConcern('majority'),
    };

    try {
      await session.startTransaction(txOptions);

      const deleted = await this.itemRepo.deleteItem(
        itemsGroupId,
        itemId,
        session,
      );
      if (!deleted) throw new InternalServerError('Item deletion failed');

      const updatedItemsGroup = await this.itemRepo.readItemsGroup(
        itemsGroupId,
        session,
      );

      await session.commitTransaction();
      return {deletedItemId: itemId, itemsGroup: updatedItemsGroup};
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  public async moveItem(
    versionId: string,
    moduleId: string,
    sectionId: string,
    itemId: string,
    body: MoveItemBody,
  ) {
    const {afterItemId, beforeItemId} = body;
    if (!afterItemId && !beforeItemId) {
      throw new Error('Either afterItemId or beforeItemId is required');
    }

    const client = await this.courseRepo.getDBClient();
    const session = client.startSession();
    const txOptions = {
      readPreference: ReadPreference.primary,
      readConcern: new ReadConcern('snapshot'),
      writeConcern: new WriteConcern('majority'),
    };

    try {
      await session.startTransaction(txOptions);

      const version = await this.courseRepo.readVersion(versionId, session);
      const module = version.modules.find(m => m.moduleId === moduleId)!;
      const section = module.sections.find(s => s.sectionId === sectionId)!;
      const itemsGroup = await this.itemRepo.readItemsGroup(
        section.itemsGroupId.toString(),
        session,
      );

      const sortedItems = itemsGroup.items.sort((a, b) =>
        a.order.localeCompare(b.order),
      );
      const newOrder = calculateNewOrder(
        sortedItems,
        'itemId',
        afterItemId,
        beforeItemId,
      );
      const item = itemsGroup.items.find(i => i.itemId.toString() === itemId)!;
      item.order = newOrder;

      // Sort items by order after updating
      itemsGroup.items.sort((a, b) => a.order.localeCompare(b.order));

      section.updatedAt = new Date();
      module.updatedAt = new Date();
      version.updatedAt = new Date();

      const updatedItemsGroup = await this.itemRepo.updateItemsGroup(
        section.itemsGroupId.toString(),
        itemsGroup,
        session,
      );
      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        version,
      );

      await session.commitTransaction();
      return {itemsGroup: updatedItemsGroup, version: updatedVersion};
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }
}
