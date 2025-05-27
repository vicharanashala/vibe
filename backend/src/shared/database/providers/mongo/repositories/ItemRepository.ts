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
import {
  ItemsGroup,
  BlogItem,
  QuizItem,
  VideoItem,
  Item,
} from 'modules/courses/classes/transformers/Item';
import {ItemType} from 'shared/interfaces/Models';

@Service()
export class ItemRepository implements IItemRepository {
  private itemsGroupCollection: Collection<ItemsGroup>;
  private videoCollection: Collection<VideoItem>;
  private quizCollection: Collection<QuizItem>;
  private blogCollection: Collection<BlogItem>;

  constructor(
    @Inject(() => MongoDatabase)
    private db: MongoDatabase,
    @Inject('CourseRepo')
    private readonly courseRepo: ICourseRepository,
  ) {}

  private async init() {
    this.itemsGroupCollection =
      await this.db.getCollection<ItemsGroup>('itemsGroup');

    this.videoCollection = await this.db.getCollection<VideoItem>('video');
    this.quizCollection = await this.db.getCollection<QuizItem>('quiz');
    this.blogCollection = await this.db.getCollection<BlogItem>('blog');
  }

  // Methods for ItemsGroup operations
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

  // Methods for Item CRUD operations
  async createItem(item: Item, session?: ClientSession): Promise<Item | null> {
    await this.init();

    let collection: Collection<any> = null;
    switch (item.type) {
      case ItemType.VIDEO:
        collection = this.videoCollection;
        break;
      case ItemType.QUIZ:
        collection = this.quizCollection;
        break;
      case ItemType.BLOG:
        collection = this.blogCollection;
        break;
      default:
        throw new Error(`Unsupported item type: ${(item as any).type}`);
    }
    const result = await collection.insertOne(item, {session});
    if (!result.insertedId) {
      throw new Error(`Failed to insert item of type ${item.type}.`);
    }

    const createdItem = await collection.findOne(
      {_id: result.insertedId},
      {session},
    );

    return createdItem as Item;
  }

  async readItem(
    courseVersionId: string,
    itemId: string,
  ): Promise<Item | null> {
    const courseVersion = await this.courseRepo.readVersion(courseVersionId);
    if (!courseVersion) {
      throw new ReadError(`Version ${courseVersionId} not found.`);
    }

    for (const module of courseVersion.modules) {
      for (const section of module.sections) {
        const itemsGroup = await this.readItemsGroup(
          section.itemsGroupId.toString(),
        );
        const found = itemsGroup.items.find(i => i._id.toString() === itemId);

        if (found) {
          let item: Item = null;

          switch (found.type) {
            case ItemType.VIDEO:
              item = (await this.videoCollection.findOne({
                _id: found._id,
              })) as VideoItem;
              break;
            case ItemType.QUIZ:
              item = (await this.quizCollection.findOne({
                _id: found._id,
              })) as QuizItem;
              break;
            case ItemType.BLOG:
              item = (await this.blogCollection.findOne({
                _id: found._id,
              })) as BlogItem;
              break;
            default:
              throw new ReadError(`Unknown item type: ${found.type}`);
          }

          return item;
        }
      }
    }

    // Step 3: If item isn't found after going through all sections
    throw new NotFoundError(
      `Item ${itemId} not found in version ${courseVersionId}.`,
    );
  }

  async updateItem(item: Item, session?: ClientSession): Promise<Item> {
    await this.init();

    const {_id, type} = item;
    if (!_id) {
      throw new UpdateError('Item ID is required for update.');
    }

    let collection: Collection<any>;
    switch (type) {
      case ItemType.VIDEO:
        collection = this.videoCollection;
        break;
      case ItemType.QUIZ:
        collection = this.quizCollection;
        break;
      case ItemType.BLOG:
        collection = this.blogCollection;
        break;
      default:
        throw new UpdateError(`Unsupported item type: ${(item as any).type}`);
    }

    try {
      const result = await collection.updateOne(
        {_id: new ObjectId(_id)},
        {
          $set: {
            name: item.name,
            description: item.description,
            details: item.details,
          },
        },
        {session},
      );

      if (result.modifiedCount === 0) {
        throw new UpdateError(`Failed to update item of type ${type}.`);
      }

      // Also update the embedded item in the itemsGroup (for UI sync, etc.)
      const updateInGroup = await this.itemsGroupCollection.updateOne(
        {'items._id': new ObjectId(_id)},
        {
          $set: {
            'items.$.name': item.name,
            'items.$.description': item.description,
            'items.$.details': item.details,
          },
        },
        {session},
      );

      if (updateInGroup.modifiedCount === 0) {
        throw new UpdateError(
          `Failed to update item in itemsGroup for ID ${_id}.`,
        );
      }

      const updatedItem = await collection.findOne(
        {_id: new ObjectId(_id)},
        {session},
      );

      if (!updatedItem) {
        throw new UpdateError(`Failed to fetch updated item with ID ${_id}.`);
      }

      return instanceToPlain(updatedItem) as Item;
    } catch (error) {
      throw new UpdateError(`updateItem error for type ${type}: ${error}`);
    }
  }

  async deleteItem(itemGroupsId: string, itemId: string): Promise<boolean> {
    await this.init();
    try {
      const result = await this.itemsGroupCollection.updateOne(
        {_id: new ObjectId(itemGroupsId)},
        {$pull: {items: {_id: new ObjectId(itemId)}}},
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
        itemId: new ObjectId(firstItem._id),
      };
    } catch (error) {
      throw new ReadError('getFirstOrderItems error: ' + error);
    }
  }
}
