import {ItemsGroup} from 'modules/courses/classes/transformers/index';
import {
  IBaseItem,
  IVideoDetails,
  IQuizDetails,
  IBlogDetails,
  ICourseVersion,
} from 'shared/interfaces/Models';
import {ObjectId, ClientSession} from 'mongodb';

export interface IItemRepository {
  readItem(
    courseVersionId: string,
    itemId: string,
    session?: ClientSession,
  ): Promise<IBaseItem | null>;

  deleteItem(
    itemGroupsId: string,
    itemId: string,
    session?: ClientSession,
  ): Promise<boolean>;

  createItemsGroup(
    itemsGroup: ItemsGroup,
    session?: ClientSession,
  ): Promise<ItemsGroup | null>;

  readItemsGroup(
    itemsGroupId: string,
    session?: ClientSession,
  ): Promise<ItemsGroup | null>;

  updateItemsGroup(
    itemsGroupId: string,
    itemsGroup: ItemsGroup,
    session?: ClientSession,
  ): Promise<ItemsGroup | null>;

  getFirstOrderItems(
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<{
    moduleId: ObjectId;
    sectionId: ObjectId;
    itemId: ObjectId;
  }>;

  // createVideoDetails(details: IVideoDetails): Promise<string>;
  // createQuizDetails(details: IQuizDetails): Promise<string>;
  // createBlogDetails(details: IBlogDetails): Promise<string>;

  // readVideoDetails(detailsId: string): Promise<IVideoDetails | null>;
  // readQuizDetails(detailsId: string): Promise<IQuizDetails | null>;
  // readBlogDetails(detailsId: string): Promise<IBlogDetails | null>;
}
