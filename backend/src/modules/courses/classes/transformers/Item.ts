import { calculateNewOrder } from '#courses/utils/calculateNewOrder.js';

import { Expose, Transform, Type } from 'class-transformer';
import { ObjectId } from 'mongodb';

import {
  ObjectIdToString,
  StringToObjectId,
} from '#root/shared/constants/transformerConstants.js';
import {
  ID,
  ItemType,
  IQuizDetails,
  IVideoDetails,
  IBlogDetails,
} from '#root/shared/interfaces/models.js';

export type Item = QuizItem | VideoItem | BlogItem | ProjectItem;

class QuizItem {
  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  _id?: ID;

  @Expose()
  name: string;

  @Expose()
  description: string;

  @Expose()
  type: ItemType = ItemType.QUIZ;

  @Expose()
  details?: IQuizDetails;

  constructor(
    name: string,
    description: string,
    details: IQuizDetails,
    _id: ID,
  ) {
    this._id = _id;
    this.type = ItemType.QUIZ;
    this.name = name;
    this.description = description;
    this.details = details;
  }
}

class VideoItem {
  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  _id?: ID;

  @Expose()
  name: string;

  @Expose()
  description: string;

  @Expose()
  type: ItemType = ItemType.VIDEO;

  @Expose()
  details?: IVideoDetails;

  constructor(
    name: string,
    description: string,
    details: IVideoDetails,
    _id: ID,
  ) {
    this._id = _id;
    this.type = ItemType.VIDEO;
    this.name = name;
    this.description = description;
    this.details = details;
  }
}

class BlogItem {
  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  _id?: ID;

  @Expose()
  name: string;

  @Expose()
  description: string;

  @Expose()
  type: ItemType = ItemType.BLOG;

  @Expose()
  details?: IBlogDetails;

  constructor(
    name: string,
    description: string,
    details: IBlogDetails,
    _id: ID,
  ) {
    this._id = _id;
    this.type = ItemType.BLOG;
    this.name = name;
    this.description = description;
    this.details = details;
  }
}

class ProjectItem {
  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  _id?: ID;

  @Expose()
  name: string;

  @Expose()
  description: string;

  @Expose()
  type: ItemType = ItemType.PROJECT;

  details?: any;
  constructor(name: string, description: string, _id: ID, details?: any) {
    this._id = _id;
    this.type = ItemType.PROJECT;
    this.name = name;
    this.description = description;
    if (details) {
      this.details = details;
    }
  }
}

class ItemBase {
  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  itemId?: ID;

  @Expose()
  type: ItemType;

  @Expose()
  order: string;

  @Expose()
  itemDetails: Item;

  constructor(itemBody: any, existingItems: ItemRef[]) {
    this.itemId = new ObjectId();
    const quizDetails = itemBody.quizDetails as IQuizDetails;
    if (itemBody) {
      this.type = itemBody.type;
      switch (this.type) {
        case ItemType.VIDEO:
          this.itemDetails = new VideoItem(
            itemBody.name,
            itemBody.description,
            itemBody.videoDetails,
            this.itemId,
          );
          break;
        case ItemType.QUIZ:
          // Preserve questionBankRefs from request body instead of overriding
          this.itemDetails = new QuizItem(
            itemBody.name,
            itemBody.description,
            quizDetails,
            this.itemId,
          );
          break;
        case ItemType.BLOG:
          this.itemDetails = new BlogItem(
            itemBody.name,
            itemBody.description,
            itemBody.blogDetails,
            this.itemId,
          );
          break;
        case ItemType.PROJECT:
          // For PROJECT, prefer details.name/description if present (for consistency with validation)
          let pname = itemBody.name;
          let pdesc = itemBody.description;
          if (itemBody.details && (itemBody.details.name || itemBody.details.description)) {
            pname = itemBody.details.name || pname;
            pdesc = itemBody.details.description || pdesc;
          }
          this.itemDetails = new ProjectItem(pname, pdesc, this.itemId, itemBody.details);
          break;
        default:
          break;
      }
    }

    if (existingItems) {
      const sortedItems = existingItems.sort((a, b) =>
        a.order.localeCompare(b.order),
      );
      this.order = calculateNewOrder(
        sortedItems,
        '_id',
        itemBody.afterItemId,
        itemBody.beforeItemId,
      );
    }
  }
}

class ItemRef {
  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  _id?: ID;

  @Expose()
  type: ItemType;

  @Expose()
  order: string;

  constructor(item: ItemBase) {
    this._id = new ObjectId(item.itemId);
    this.type = item.type;
    this.order = item.order;
  }
}

class ItemsGroup {
  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  _id?: ID;

  @Expose()
  @Type(() => ItemRef)
  items: ItemRef[];

  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  sectionId: ID;

  constructor(sectionId?: ID, items?: ItemRef[]) {
    this.items = items ? items : [];
    this.sectionId = sectionId;
  }
}

export { ItemBase, ItemsGroup, ItemRef, QuizItem, VideoItem, BlogItem, ProjectItem };
