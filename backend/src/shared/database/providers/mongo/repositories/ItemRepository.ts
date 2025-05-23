import 'reflect-metadata';
import {instanceToPlain} from 'class-transformer';
import {Collection, ClientSession, ObjectId} from 'mongodb';
import {IItemRepository} from 'shared/database/interfaces/IItemRepository';
import {ICourseRepository} from 'shared/database/interfaces/ICourseRepository';
import {
  CreateError,
  DeleteError,
  ReadError,
  UpdateError,
} from 'shared/errors/errors';
import {Service, Inject} from 'typedi';
import {MongoDatabase} from '../MongoDatabase';
import {NotFoundError} from 'routing-controllers';
import {ItemsGroup, Item} from 'modules/courses/classes/transformers/Item';

@Service()
export class ItemRepository implements IItemRepository {
  private itemsGroupCollection: Collection<ItemsGroup>;

  constructor(
    @Inject(() => MongoDatabase)
    private db: MongoDatabase,
    @Inject('CourseRepo')
    private readonly courseRepo: ICourseRepository,
  ) {}

  private async init() {
    this.itemsGroupCollection =
      await this.db.getCollection<ItemsGroup>('itemsGroup');
  }

  async createItemsGroup(
    itemsGroup: ItemsGroup,
    session?: ClientSession,
  ): Promise<ItemsGroup> {
    await this.init();
    try {
      const result = await this.itemsGroupCollection.insertOne(itemsGroup, {
        session,
      });
      if (!result.insertedId) {
        throw new CreateError('Failed to create items group.');
      }
      const newItemsGroup = await this.itemsGroupCollection.findOne(
        {_id: result.insertedId},
        {session},
      );
      if (!newItemsGroup) {
        throw new ReadError('Failed to fetch newly created items group.');
      }
      return instanceToPlain(
        Object.assign(new ItemsGroup(), newItemsGroup),
      ) as ItemsGroup;
    } catch (error) {
      throw new CreateError('createItemsGroup error: ' + error);
    }
  }

  async readItemsGroup(
    itemsGroupId: string,
    session?: ClientSession,
  ): Promise<ItemsGroup> {
    await this.init();
    try {
      const itemsGroup = await this.itemsGroupCollection.findOne(
        {_id: new ObjectId(itemsGroupId)},
        {session},
      );
      if (!itemsGroup) {
        throw new NotFoundError(`ItemsGroup ${itemsGroupId} not found.`);
      }
      return instanceToPlain(
        Object.assign(new ItemsGroup(), itemsGroup),
      ) as ItemsGroup;
    } catch (error) {
      throw new ReadError('readItemsGroup error: ' + error);
    }
  }

  async readItem(courseVersionId: string, itemId: string): Promise<Item> {
    // Reading operations need no transaction
    const courseVersion = await this.courseRepo.readVersion(courseVersionId);
    if (!courseVersion) {
      throw new ReadError(`Version ${courseVersionId} not found.`);
    }

    for (const module of courseVersion.modules) {
      for (const section of module.sections) {
        const itemsGroup = await this.readItemsGroup(
          section.itemsGroupId.toString(),
        );
        const found = itemsGroup.items.find(
          i => i.itemId.toString() === itemId,
        );
        if (found) {
          return found;
        }
      }
    }
    throw new NotFoundError(
      `Item ${itemId} not found in version ${courseVersionId}.`,
    );
  }

  async updateItemsGroup(
    itemsGroupId: string,
    itemsGroup: ItemsGroup,
    session: ClientSession,
  ): Promise<ItemsGroup> {
    await this.init();
    try {
      const {_id, ...fields} = itemsGroup;
      const result = await this.itemsGroupCollection.updateOne(
        {_id: new ObjectId(itemsGroupId)},
        {$set: fields},
        {session},
      );
      if (result.modifiedCount !== 1) {
        throw new UpdateError(`Failed to update items group ${itemsGroupId}.`);
      }
      const updated = await this.itemsGroupCollection.findOne(
        {_id: new ObjectId(itemsGroupId)},
        {session},
      );
      if (!updated) {
        throw new ReadError(
          `Failed to read updated items group ${itemsGroupId}.`,
        );
      }
      return instanceToPlain(
        Object.assign(new ItemsGroup(), updated),
      ) as ItemsGroup;
    } catch (error) {
      throw new UpdateError('updateItemsGroup error: ' + error);
    }
  }

  async deleteItem(itemGroupsId: string, itemId: string): Promise<boolean> {
    await this.init();
    try {
      const result = await this.itemsGroupCollection.updateOne(
        {_id: new ObjectId(itemGroupsId)},
        {$pull: {items: {itemId: new ObjectId(itemId)}}},
      );
      if (result.modifiedCount === 1) {
        return true;
      } else {
        throw new DeleteError('Failed to delete item');
      }
    } catch (error) {
      throw new DeleteError('Failed to delete item.\n More Details: ' + error);
    }
  }

  async getFirstOrderItems(
    courseVersionId: string,
  ): Promise<{moduleId: ObjectId; sectionId: ObjectId; itemId: ObjectId}> {
    try {
      const version = await this.courseRepo.readVersion(courseVersionId);
      if (!version || version.modules.length === 0) {
        throw new ReadError('Course version has no modules');
      }

      const firstModule = version.modules
        .slice()
        .sort((a, b) => a.order.localeCompare(b.order))[0];
      if (!firstModule.sections.length) {
        throw new ReadError('Module has no sections');
      }

      const firstSection = firstModule.sections
        .slice()
        .sort((a, b) => a.order.localeCompare(b.order))[0];
      const itemsGroup = await this.readItemsGroup(
        firstSection.itemsGroupId.toString(),
      );
      if (!itemsGroup.items.length) {
        throw new ReadError('Items group has no items');
      }

      const firstItem = itemsGroup.items
        .slice()
        .sort((a, b) => a.order.localeCompare(b.order))[0];

      return {
        moduleId: new ObjectId(firstModule.moduleId),
        sectionId: new ObjectId(firstSection.sectionId),
        itemId: new ObjectId(firstItem.itemId),
      };
    } catch (error) {
      throw new ReadError('getFirstOrderItems error: ' + error);
    }
  }
}
