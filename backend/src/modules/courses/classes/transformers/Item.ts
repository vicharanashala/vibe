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
  IFeedBackFormDetails,
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

  @Expose()
  isDeleted?: boolean;

  @Expose()
  deletedAt?: Date;

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
    this.isDeleted = false;
    this.deletedAt = undefined;
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

  @Expose()
  isDeleted?: boolean;

  @Expose()
  deletedAt?: Date;

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
    this.isDeleted = false;
    this.deletedAt = undefined;
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

  @Expose()
  isDeleted?: boolean;

  @Expose()
  deletedAt?: Date;

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
    this.isDeleted = false;
    this.deletedAt = undefined;
  }
}

class FeedBackFormItem {
  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  _id?: ID;

  @Expose()
  name: string;

  @Expose()
  description: string;

  @Expose()
  isOptional: boolean;

  @Expose()
  type: ItemType = ItemType.FEEDBACK;

  @Expose()
  details: IFeedBackFormDetails;

  constructor(
    name: string,
    description: string,
    _id: ID,
    details?: IFeedBackFormDetails,
  ) {
    this._id = _id;
    this.type = ItemType.FEEDBACK;
    this.name = name;
    this.isOptional = false;
    this.description = description;

    if (details) {
      this.details = details;
    }
  }
}

class FeedbackSubmissionItem {
  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  _id?: ID;

  @Expose()
  userId: ID;

  @Expose()
  courseId: ID;

  @Expose()
  courseVersionId: ID;

  @Expose()
  previousItemId: ID;

  @Expose()
  previousItemType: ItemType;

  @Expose()
  feedbackFormId: ID;

  @Expose()
  details: Record<string, any>;

  // @Expose()
  // isSkipped: boolean;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  constructor(
    userId: string,
    courseId: string,
    courseVersionId: string,
    previousItemId: string,
    previousItemType: ItemType,
    feedbackFormId: string,
    details: Record<string, any>,
    _id?: ID,
  ) {
    this._id = _id;
    this.userId = userId;
    this.courseId = courseId;
    this.courseVersionId = courseVersionId;
    this.previousItemId = previousItemId;
    this.previousItemType = previousItemType;
    this.feedbackFormId = feedbackFormId;
    this.details = details;
    // this.isSkipped = isSkipped;
    this.createdAt = new Date();
    this.updatedAt = new Date();
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

  @Expose()
  isDeleted?: boolean;

  @Expose()
  deletedAt?: Date;

  constructor(name: string, description: string, _id: ID, details?: any) {
    this._id = _id;
    this.type = ItemType.PROJECT;
    this.name = name;
    this.description = description;

    if (details) {
      this.details = details;
    }
    this.isDeleted = false;
    this.deletedAt = undefined;
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
          quizDetails.questionBankRefs = [];
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
          if (
            itemBody.details &&
            (itemBody.details.name || itemBody.details.description)
          ) {
            pname = itemBody.details.name || pname;
            pdesc = itemBody.details.description || pdesc;
          }
          this.itemDetails = new ProjectItem(
            pname,
            pdesc,
            this.itemId,
            itemBody.details,
          );
          break;
        case ItemType.FEEDBACK:
          this.itemDetails = new FeedBackFormItem(
            itemBody.name,
            itemBody.description,
            this.itemId,
            itemBody.feedbackFormDetails,
          );
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

export {
  ItemBase,
  ItemsGroup,
  ItemRef,
  QuizItem,
  VideoItem,
  BlogItem,
  ProjectItem,
  FeedBackFormItem,
  FeedbackSubmissionItem,
};
