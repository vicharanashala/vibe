import 'reflect-metadata';
import { Expose, Transform, Type } from "class-transformer";
import { calculateNewOrder } from "modules/courses/utils/calculateNewOrder";
import { ObjectId } from "mongodb";
import { ObjectIdToString, StringToObjectId } from "shared/constants/transformerConstants";
import { IBaseItem, ItemType, IVideoDetails, IQuizDetails, IBlogDetails } from "shared/interfaces/IUser";
import { ID } from "shared/types";
import { CreateItemPayloadValidator } from "../validators/ItemValidators";
import e from "express";

class Item implements IBaseItem {
  @Expose()
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
  @Transform(StringToObjectId.transformer, { toClassOnly: true })
  itemId?: ID;

  @Expose()
  name: string;

  @Expose()
  description: string;

  @Expose()
  type: ItemType;

  @Expose()
  order: string;


  itemDetails: IVideoDetails | IQuizDetails | IBlogDetails;

  constructor(itemPayload: CreateItemPayloadValidator, existingItems: Item[]) {
    if (itemPayload) {
      this.name = itemPayload.name;
      this.description = itemPayload.description;
      this.type = itemPayload.type;
      switch (this.type) {
        case ItemType.VIDEO:
          this.itemDetails = itemPayload.videoDetails;
          break;
        case ItemType.QUIZ:
          this.itemDetails = itemPayload.quizDetails;
          break;
        case ItemType.BLOG:
          this.itemDetails = itemPayload.blogDetails;
          break;
        default:
          break;
      }
    }
    this.itemId = new ObjectId();
    let sortedItems = existingItems.sort((a, b) =>
      a.order.localeCompare(b.order)
    );
    this.order = calculateNewOrder(
      sortedItems,
      "itemId",
      itemPayload.afterItemId,
      itemPayload.beforeItemId
    );
  }
}


class ItemsGroup {

	@Expose()
	@Transform(ObjectIdToString.transformer, { toPlainOnly: true })
	@Transform(StringToObjectId.transformer, { toClassOnly: true })
	_id?: ID;

	@Expose()
	@Type(() => Item)
	items: Item[];

	@Expose()
	@Transform(ObjectIdToString.transformer, { toPlainOnly: true })
	@Transform(StringToObjectId.transformer, { toClassOnly: true })
	sectionId: ID;

	constructor(sectionId?: ID, items?: Item[], ) {
		this.items = items? items :[];
		this.sectionId = sectionId;
	}
}

export { Item, ItemsGroup };