import {Item, ItemRef, ItemsGroup} from '#courses/classes/transformers/Item.js';
import {UpdateItemBody} from '#root/modules/courses/classes/index.js';
import {IQuizItem} from '#root/shared/interfaces/models.js';
import {ClientSession, ObjectId} from 'mongodb';

export interface IItemRepository {
  readItem(
    courseVersionId: string,
    itemId: string,
    session?: ClientSession,
  ): Promise<Item | null>;

  readItemById(itemId: string, session?: ClientSession): Promise<Item | null>;

  deleteItem(
    itemGroupsId: string,
    itemId: string,
    session?: ClientSession,
  ): Promise<ItemsGroup | null>;
  getItemsCountByGroupIds(groupIds: string[], session?: ClientSession);
  getQuizInfo(
    itemGroupIds: string[],
    session?: ClientSession,
  ): Promise<{_id: ObjectId; items: ItemRef}[]>;
  createItemsGroup(
    itemsGroup: ItemsGroup,
    session?: ClientSession,
  ): Promise<ItemsGroup | null>;
  createItems(items: Item[], session?: ClientSession): Promise<Item[]>;
  readItemsGroup(
    itemsGroupId: string,
    session?: ClientSession,
  ): Promise<ItemsGroup>;

  updateItemsGroup(
    itemsGroupId: string,
    itemsGroup: ItemsGroup,
    session?: ClientSession,
  ): Promise<ItemsGroup | null>;

  updateItem(
    itemId: string,
    item: UpdateItemBody,
    session?: ClientSession,
  ): Promise<Item>;

  findItemsGroupByItemId(
    itemId: string,
    session?: ClientSession,
  ): Promise<ItemsGroup | null>;

  getFirstOrderItems(
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<{
    moduleId: ObjectId;
    sectionId: ObjectId;
    itemId: ObjectId;
  } | null>;

  createItem(item: Item, session?: ClientSession): Promise<Item | null>;
  CalculateTotalItemsCount(
    courseId: string,
    versionId: string,
    session?: ClientSession,
  ): Promise<number>;
  getTotalItemsCount(
    courseId: string,
    versionId: string,
    session?: ClientSession,
  ): Promise<number>;

  cascadeDeleteItem(session?: ClientSession): Promise<void>;

  getItemGroupsByIds(
    groupIds: (string | ObjectId)[],
    session?: ClientSession,
  ): Promise<ItemsGroup[]>;
  updateItemsGroupsBulk(
    itemGroups: ItemsGroup[],
    session?: ClientSession,
  ): Promise<number>;
  updateItemById(
    itemId: string,
    item: Item,
    itemType: string,
    session?: ClientSession,
  ): Promise<Item>;
  calculateItemCountsForVersion(
    versionId: string,
    session?: ClientSession,
  ): Promise<{totalItems: any; itemCounts: any}>;
  // createVideoDetails(details: IVideoDetails): Promise<string>;
  // createQuizDetails(details: IQuizDetails): Promise<string>;
  // createBlogDetails(details: IBlogDetails): Promise<string>;

  // readVideoDetails(detailsId: string): Promise<IVideoDetails | null>;
  // readQuizDetails(detailsId: string): Promise<IQuizDetails | null>;
  // readBlogDetails(detailsId: string): Promise<IBlogDetails | null>;
}
