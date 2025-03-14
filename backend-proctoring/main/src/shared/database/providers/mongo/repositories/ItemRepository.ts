import { Collection, ObjectId } from "mongodb";
import { Inject, Service } from "typedi";
import { MongoDatabase } from "../MongoDatabase";
import {
  IBaseItem,
  IVideoDetails,
  IQuizDetails,
  IBlogDetails,
} from "shared/interfaces/IUser";
import { IItemRepository } from "shared/database/interfaces/IItemRepository";

type MongoBaseItem = Omit<IBaseItem, "sectionId" | "itemDetailsId"> & {
  sectionId: ObjectId;
  itemDetailsId: ObjectId;
};

@Service()
export class ItemRepository implements IItemRepository {
  private itemsCollection!: Collection<MongoBaseItem>;
  private videosCollection!: Collection<IVideoDetails>;
  private quizzesCollection!: Collection<IQuizDetails>;
  private blogsCollection!: Collection<IBlogDetails>;

  constructor(@Inject(() => MongoDatabase) private db: MongoDatabase) {}

  private async init(): Promise<void> {
    if (!this.itemsCollection)
      this.itemsCollection = await this.db.getCollection<MongoBaseItem>(
        "items"
      );
    if (!this.videosCollection)
      this.videosCollection = await this.db.getCollection<IVideoDetails>(
        "videos"
      );
    if (!this.quizzesCollection)
      this.quizzesCollection = await this.db.getCollection<IQuizDetails>(
        "quizzes"
      );
    if (!this.blogsCollection)
      this.blogsCollection = await this.db.getCollection<IBlogDetails>("blogs");
  }

  async createItem(item: IBaseItem): Promise<IBaseItem | null> {
    await this.init();

    const result = await this.itemsCollection.insertOne({
      ...item,
      sectionId: new ObjectId(item.sectionId),
      itemDetailsId: new ObjectId(item.itemDetailsId),
    });
    return result.insertedId
      ? { ...item, sectionId: item.sectionId, id: result.insertedId.toString() }
      : null;
  }

  async readItem(itemId: string): Promise<IBaseItem | null> {
    await this.init();

    const item = await this.itemsCollection.findOne({
      _id: new ObjectId(itemId),
    });
    return item
      ? {
          ...item,
          sectionId: item.sectionId.toString(),
          itemDetailsId: item.itemDetailsId.toString(),
        }
      : null;
  }

  async updateItem(
    itemId: string,
    item: Partial<IBaseItem>
  ): Promise<IBaseItem | null> {
    await this.init();

    const result = await this.itemsCollection.findOneAndUpdate(
      { _id: new ObjectId(itemId) },
      {
        $set: {
          ...item,
          sectionId: new ObjectId(item.sectionId),
          itemDetailsId: new ObjectId(item.itemDetailsId),
        },
      },
      { returnDocument: "after" }
    );

    return result
      ? {
          ...result,
          sectionId: result.sectionId.toString(),
          itemDetailsId: result.itemDetailsId.toString(),
        }
      : null;
  }

  async deleteItem(itemId: string): Promise<boolean> {
    await this.init();

    const result = await this.itemsCollection.deleteOne({
      _id: new ObjectId(itemId),
    });
    return result.deletedCount > 0;
  }

  async createVideoDetails(details: IVideoDetails): Promise<string> {
    await this.init();

    const result = await this.videosCollection.insertOne(details);
    return result.insertedId.toString();
  }

  async createQuizDetails(details: IQuizDetails): Promise<string> {
    await this.init();

    const result = await this.quizzesCollection.insertOne(details);
    return result.insertedId.toString();
  }

  async createBlogDetails(details: IBlogDetails): Promise<string> {
    await this.init();

    const result = await this.blogsCollection.insertOne(details);
    return result.insertedId.toString();
  }

  async readVideoDetails(detailsId: string): Promise<IVideoDetails | null> {
    await this.init();

    return await this.videosCollection.findOne({
      _id: new ObjectId(detailsId),
    });
  }

  async readQuizDetails(detailsId: string): Promise<IQuizDetails | null> {
    await this.init();

    return await this.quizzesCollection.findOne({
      _id: new ObjectId(detailsId),
    });
  }

  async readBlogDetails(detailsId: string): Promise<IBlogDetails | null> {
    await this.init();

    return await this.blogsCollection.findOne({ _id: new ObjectId(detailsId) });
  }
}
