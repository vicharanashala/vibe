import {
  IBaseItem,
  IVideoDetails,
  IQuizDetails,
  IBlogDetails,
} from 'shared/interfaces/Models';

export interface IItemRepository {
  createItem(item: IBaseItem): Promise<IBaseItem | null>;
  readItem(itemId: string): Promise<IBaseItem | null>;
  updateItem(
    itemId: string,
    item: Partial<IBaseItem>,
  ): Promise<IBaseItem | null>;
  deleteItem(itemId: string): Promise<boolean>;

  createVideoDetails(details: IVideoDetails): Promise<string>;
  createQuizDetails(details: IQuizDetails): Promise<string>;
  createBlogDetails(details: IBlogDetails): Promise<string>;

  readVideoDetails(detailsId: string): Promise<IVideoDetails | null>;
  readQuizDetails(detailsId: string): Promise<IQuizDetails | null>;
  readBlogDetails(detailsId: string): Promise<IBlogDetails | null>;
}
