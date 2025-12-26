import { GLOBAL_TYPES } from '#root/types.js';
import { ICourseRepository } from '#shared/database/interfaces/ICourseRepository.js';
import { IItemRepository } from '#shared/database/interfaces/IItemRepository.js';
import { ItemType } from '#shared/interfaces/models.js';
import { instanceToPlain } from 'class-transformer';
import { injectable, inject } from 'inversify';
import { Collection, ClientSession, ObjectId } from 'mongodb';
import { InternalServerError, NotFoundError } from 'routing-controllers';
import { MongoDatabase } from '../MongoDatabase.js';
import { IQuestionBank } from '#root/shared/interfaces/quiz.js';
import {
  ItemsGroup,
  VideoItem,
  QuizItem,
  BlogItem,
  ProjectItem,
  Item,
  FeedBackFormItem,
  ItemRef,
} from '#courses/classes/transformers/Item.js';
import { UpdateItemBody } from '#root/modules/courses/classes/index.js';
import { QuestionBank } from '#root/modules/quizzes/classes/transformers/QuestionBank.js';

@injectable()
export class ItemRepository implements IItemRepository {
  private itemsGroupCollection: Collection<ItemsGroup>;
  private videoCollection: Collection<VideoItem>;
  private quizCollection: Collection<QuizItem>;
  private blogCollection: Collection<BlogItem>;
  private projectCollection: Collection<ProjectItem>;
  private feedbackFormCollection: Collection<FeedBackFormItem>;
  private questionBankCollection: Collection<QuestionBank>;
  private questionsCollection: Collection<any>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,
  ) { }

  private async init() {
    this.itemsGroupCollection = await this.db.getCollection<ItemsGroup>(
      'itemsGroup',
    );
    this.videoCollection = await this.db.getCollection<VideoItem>('videos');
    this.quizCollection = await this.db.getCollection<QuizItem>('quizzes');
    this.blogCollection = await this.db.getCollection<BlogItem>('blogs');
    this.projectCollection = await this.db.getCollection<ProjectItem>(
      'projects',
    );
    this.feedbackFormCollection = await this.db.getCollection<FeedBackFormItem>(
      'feedback_forms',
    );

    this.itemsGroupCollection.createIndex({ items: 1 });
    this.questionBankCollection = await this.db.getCollection<IQuestionBank>(
      'questionBanks',
    );
    this.questionsCollection = await this.db.getCollection('questions');
  }

  // Methods for ItemsGroup operations
  async createItemsGroup(
    itemsGroup: ItemsGroup,
    session?: ClientSession,
  ): Promise<ItemsGroup> {
    await this.init();

    const result = await this.itemsGroupCollection.insertOne(itemsGroup, {
      session,
    });
    if (!result.insertedId) {
      throw new InternalServerError('Failed to create items group.');
    }
    const newItemsGroup = await this.itemsGroupCollection.findOne(
      { _id: result.insertedId },
      { session },
    );
    if (!newItemsGroup) {
      throw new InternalServerError(
        'Failed to fetch newly created items group.',
      );
    }
    return instanceToPlain(
      Object.assign(new ItemsGroup(), newItemsGroup),
    ) as ItemsGroup;
  }

  //   async getItemsCountByGroupIds(groupIds:string[]) {
  //   const itemGroups = await this.itemsGroupCollection.find({ _id: { $in: groupIds } }).select('items').lean();
  //   return itemGroups.reduce((total, group) => total + (group.items ? group.items.length : 0), 0);
  // }

  async getItemsCountByGroupIds(groupIds: string[], session?: ClientSession) {
    await this.init();
    const itemGroups = await this.itemsGroupCollection
      .find(
        { _id: { $in: groupIds.map(id => new ObjectId(id)) } },
        { projection: { items: 1 }, session }, // only return `items`
      )
      .toArray();
    console.log('Items group ', ItemsGroup);

    return itemGroups.reduce(
      (total, group) => total + (group.items ? group.items.length : 0),
      0,
    );
  }

  async readItemsGroup(
    itemsGroupId: string,
    session?: ClientSession,
  ): Promise<ItemsGroup> {
    await this.init();
    // console.log('Reading ItemsGroup with ID:', itemsGroupId);

    const itemsGroup = await this.itemsGroupCollection.findOne(
      { _id: new ObjectId(itemsGroupId), isDeleted: { $ne: true } },
      { session },
    );
    if (!itemsGroup) {
      throw new NotFoundError(`ItemsGroup ${itemsGroupId} not found.`);
    }

    // Lookup items to check if they are deleted
    const filteredItems = [];
    for (const item of itemsGroup.items) {
      let collection: Collection<any>;
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
        case ItemType.PROJECT:
          collection = this.projectCollection;
          break;
        case ItemType.FEEDBACK:
          collection = this.feedbackFormCollection;
          break;
        default:
          throw new InternalServerError(
            `Unsupported item type: ${(item as any).type}`,
          );
      }
      const existingItem = await collection.findOne(
        { _id: new ObjectId(item._id), isDeleted: { $ne: true } },
        { session },
      );
      if (existingItem) {
        filteredItems.push(item);
      }
    }

    itemsGroup.items = filteredItems;

    return instanceToPlain(
      Object.assign(new ItemsGroup(), itemsGroup),
    ) as ItemsGroup;
  }
  async updateItemsGroup(
    itemsGroupId: string,
    itemsGroup: ItemsGroup,
    session: ClientSession,
  ): Promise<ItemsGroup> {
    await this.init();
    const { _id, ...fields } = itemsGroup;
    const result = await this.itemsGroupCollection.updateOne(
      { _id: new ObjectId(itemsGroupId) },
      { $set: fields },
      { session },
    );
    if (result.matchedCount === 0) {
      throw new InternalServerError(
        `Failed to update items group ${itemsGroupId}.`,
      );
    }
    const updated = await this.itemsGroupCollection.findOne(
      { _id: new ObjectId(itemsGroupId) },
      { session },
    );
    if (!updated) {
      throw new InternalServerError(
        `Failed to read updated items group ${itemsGroupId}.`,
      );
    }
    return instanceToPlain(
      Object.assign(new ItemsGroup(), updated),
    ) as ItemsGroup;
  }

  async findItemsGroupByItemId(
    itemId: string,
    session?: ClientSession,
  ): Promise<ItemsGroup | null> {
    await this.init();

    const itemFilter =
      typeof itemId === 'string' && ObjectId.isValid(itemId)
        ? { $in: [itemId, new ObjectId(itemId)] }
        : itemId;
    const itemsGroup = await this.itemsGroupCollection.findOne(
      { 'items._id': itemFilter },
      { session },
    );
    // const itemsGroup = await this.itemsGroupCollection.findOne(
    //   { 'items._id': itemId },
    //   { session }
    // );

    if (!itemsGroup) {
      return null;
    }

    return instanceToPlain(
      Object.assign(new ItemsGroup(), itemsGroup),
    ) as ItemsGroup;
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
      case ItemType.PROJECT:
        collection = this.projectCollection;
        break;
      case ItemType.FEEDBACK:
        collection = this.feedbackFormCollection;
        break;
      default:
        throw new Error(`Unsupported item type: ${(item as any).type}`);
    }
    const result = await collection.insertOne(item, { session });
    if (!result.insertedId) {
      throw new Error(`Failed to insert item of type ${item.type}.`);
    }

    const createdItem = await collection.findOne(
      { _id: result.insertedId },
      { session },
    );

    return createdItem as Item;
  }

  async createItems(items: Item[], session?: ClientSession): Promise<Item[]> {
    await this.init();
    const createdItems: Item[] = [];

    for (const item of items) {
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
        case ItemType.PROJECT:
          collection = this.projectCollection;
          break;
        default:
          throw new Error(`Unsupported item type: ${item.type}`);
      }

      const result = await collection.insertOne(item, { session });
      if (!result.insertedId) {
        throw new Error(`Failed to insert item of type ${item.type}`);
      }

      const createdItem = await collection.findOne(
        { _id: result.insertedId },
        { session },
      );
      if (!createdItem)
        throw new Error(`Failed to fetch inserted item of type ${item.type}`);
      createdItems.push(createdItem);
    }
    return createdItems;
  }

  async readItem(
    courseVersionId: string,
    itemId: string,
    session?: ClientSession,
  ): Promise<Item | null> {
    await this.init();

    const courseVersion = await this.courseRepo.readVersion(courseVersionId);
    if (!courseVersion) {
      throw new InternalServerError(`Version ${courseVersionId} not found.`);
    }

    for (const module of courseVersion.modules) {
      for (const section of module.sections) {
        const itemsGroup = await this.readItemsGroup(
          section?.itemsGroupId?.toString(),
        );
        const found = itemsGroup?.items?.find(
          i => i?._id?.toString() === itemId,
        );

        if (found) {
          if (!found._id) {
            console.error('Found item has a null or undefined _id:', found);
            throw new InternalServerError('Item has an invalid ID');
          }
          console.log(
            await this.feedbackFormCollection.findOne({
              _id: new ObjectId(found._id),
            }),
          );

          let item: Item = null;
          switch (found.type) {
            case ItemType.VIDEO:
              item = (await this.videoCollection.findOne({
                _id: new ObjectId(found._id),
                isDeleted: { $ne: true },
              })) as VideoItem;
              break;
            case ItemType.QUIZ:
              item = (await this.quizCollection.findOne({
                _id: new ObjectId(found._id),
                isDeleted: { $ne: true },
              })) as QuizItem;
              break;
            case ItemType.BLOG:
              item = (await this.blogCollection.findOne({
                _id: new ObjectId(found._id),
                isDeleted: { $ne: true },
              })) as BlogItem;
              break;
            case ItemType.PROJECT:
              item = (await this.projectCollection.findOne({
                _id: new ObjectId(found._id),
                isDeleted: { $ne: true },
              })) as ProjectItem;
              break;
            case ItemType.FEEDBACK:
              item = (await this.feedbackFormCollection.findOne({
                _id: new ObjectId(found._id),
              })) as FeedBackFormItem;
              break;
            default:
              throw new InternalServerError(`Unknown item type: ${found.type}`);
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

  async readItemById(
    itemId: string,
    session?: ClientSession,
  ): Promise<Item> {
    await this.init();

    const objectId = new ObjectId(itemId);

    let item: Item =
      (await this.videoCollection.findOne({
        _id: objectId,
        isDeleted: { $ne: true },
      })) ||
      (await this.quizCollection.findOne({
        _id: objectId,
        isDeleted: { $ne: true },
      })) ||
      (await this.blogCollection.findOne({
        _id: objectId,
        isDeleted: { $ne: true },
      })) ||
      (await this.projectCollection.findOne({
        _id: objectId,
        isDeleted: { $ne: true },
      })) ||
      (await this.feedbackFormCollection.findOne({
        _id: objectId,
      }));

    if (!item) {
      throw new NotFoundError(`Item ${itemId} not found`);
    }

    return item;
  }


  async updateItem(
    itemId: string,
    item: UpdateItemBody,
    session?: ClientSession,
  ): Promise<Item> {
    await this.init();
    const type = item.type;
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
      case ItemType.PROJECT:
        collection = this.projectCollection;
        break;
      case ItemType.FEEDBACK:
        collection = this.feedbackFormCollection;
        break;
      default:
        throw new InternalServerError(
          `Unsupported item type: ${(item as any).type}`,
        );
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(itemId) },
      {
        $set: {
          name: item.name,
          description: item.description,
          // ...(item.type === ItemType.FEEDBACK && {
          isOptional: item.isOptional,
          // }),
          details: item?.details,
        },
      },
      { returnDocument: 'after', session },
    );

    if (!result) {
      throw new NotFoundError(`Item ${itemId} not found.`);
    }

    return result;
  }

  async deleteItem(
    itemGroupsId: string,
    itemId: string,
    session?: ClientSession,
  ): Promise<ItemsGroup> {
    await this.init();
    const itemsGroup = await this.readItemsGroup(itemGroupsId, session);
    if (!itemsGroup) {
      throw new NotFoundError('ItemsGroup not found.');
    }
    // Find the item to delete
    const itemIndex = itemsGroup.items.findIndex(
      item => item._id.toString() === itemId,
    );
    if (itemIndex === -1) {
      throw new NotFoundError(
        `Item ${itemId} not found in ItemsGroup ${itemGroupsId}.`,
      );
    }
    // Delete the item from the appropriate collection based on its type
    if (itemsGroup.items[itemIndex].type === ItemType.VIDEO) {
      await this.videoCollection.updateOne(
        { _id: new ObjectId(itemId) },
        { $set: { isDeleted: true, deletedAt: new Date() } },
        { session },
      );
    } else if (itemsGroup.items[itemIndex].type === ItemType.QUIZ) {
      const itemObjectId = new ObjectId(itemId);
      const now = new Date();

      // 1. Fetch quizItem
      const quizItem = await this.quizCollection.findOne(
        { _id: itemObjectId },
        { session },
      );

      if (!quizItem) {
        throw new NotFoundError(`Quiz item ${itemId} not found.`);
      }

      // 2. Soft delete quiz item
      await this.quizCollection.updateOne(
        { _id: itemObjectId },
        { $set: { isDeleted: true, deletedAt: now } },
        { session },
      );

      // 3. Extract questionBankIds
      const questionBankIds = quizItem.details.questionBankRefs.map(
        qb => new ObjectId(qb.bankId),
      );

      // 4. Soft delete the question banks
      await this.questionBankCollection.updateMany(
        { _id: { $in: questionBankIds } },
        { $set: { isDeleted: true, deletedAt: now } },
        { session },
      );

      // 5. Pull all questionIds
      const questionBanks = await this.questionBankCollection
        .find(
          { _id: { $in: questionBankIds } },
          { projection: { questions: 1 }, session },
        )
        .toArray();

      const questionIds = questionBanks
        .flatMap(qb => qb.questions || [])
        .map(qid => new ObjectId(qid));

      // skip update if none
      if (questionIds.length > 0) {
        await this.questionsCollection.updateMany(
          { _id: { $in: questionIds } },
          { $set: { isDeleted: true, deletedAt: now } },
          { session },
        );
      }
    } else if (itemsGroup.items[itemIndex].type === ItemType.BLOG) {
      await this.blogCollection.updateOne(
        { _id: new ObjectId(itemId) },
        { $set: { isDeleted: true, deletedAt: new Date() } },
        { session },
      );
    } else if (itemsGroup.items[itemIndex].type === ItemType.PROJECT) {
      await this.projectCollection.updateOne(
        { _id: new ObjectId(itemId) },
        { $set: { isDeleted: true, deletedAt: new Date() } },
        { session },
      );
    } else if (itemsGroup.items[itemIndex].type === ItemType.FEEDBACK) {
      await this.feedbackFormCollection.deleteOne(
        {
          _id: new ObjectId(itemId),
        },
        { session },
      );
    } else {
      throw new InternalServerError(
        `Unsupported item type: ${(itemsGroup.items[itemIndex] as any).type}`,
      );
    }
    itemsGroup.items.splice(itemIndex, 1);

    await this.itemsGroupCollection.updateOne(
      { _id: new ObjectId(itemGroupsId) },
      { $set: { items: itemsGroup.items } },
      { session },
    );

    return itemsGroup;
  }

  async getFirstOrderItems(
    courseVersionId: string,
  ): Promise<{ moduleId: ObjectId; sectionId: ObjectId; itemId: ObjectId }> {
    await this.init();

    const version = await this.courseRepo.readVersion(courseVersionId);
    if (!version || version.modules.length === 0) {
      throw new InternalServerError('Course version has no modules');
    }

    const firstModule = version.modules
      .slice()
      .sort((a, b) => a.order.localeCompare(b.order))[0];
    if (!firstModule.sections.length) {
      throw new InternalServerError('Module has no sections');
    }

    const firstSection = firstModule.sections
      .slice()
      .sort((a, b) => a.order.localeCompare(b.order))[0];
    const itemsGroup = await this.readItemsGroup(
      firstSection.itemsGroupId.toString(),
    );
    if (!itemsGroup.items.length) {
      throw new InternalServerError('Items group has no items');
    }

    const firstItem = itemsGroup.items
      .slice()
      .sort((a, b) => a.order.localeCompare(b.order))[0];

    return {
      moduleId: new ObjectId(firstModule.moduleId),
      sectionId: new ObjectId(firstSection.sectionId),
      itemId: new ObjectId(firstItem._id),
    };
  }

  async CalculateTotalItemsCount(
    courseId: string,
    versionId: string,
    session?: ClientSession,
  ): Promise<number> {
    await this.init();

    const version = await this.courseRepo.readVersion(versionId, session);
    if (!version) {
      throw new NotFoundError(`Course version ${versionId} not found.`);
    }

    // console.log("Version from calculate totalCount: ", version, versionId)
    // Verify that the version belongs to the specified course
    if (version.courseId.toString() !== courseId) {
      throw new NotFoundError(
        `Version ${versionId} does not belong to course ${courseId}.`,
      );
    }

    // let totalCount = 0;

    // // Iterate through all modules
    // for (const module of version.modules) {
    //   // Iterate through all sections in each module
    //   for (const section of module.sections) {
    //     try {
    //       const itemsGroup = await this.readItemsGroup(
    //         section.itemsGroupId.toString(),
    //         session,
    //       );
    //       totalCount += itemsGroup.items.length;
    //     } catch (error) {
    //       // If itemsGroup is not found, skip this section
    //       if (error instanceof NotFoundError) {
    //         continue;
    //       }
    //       throw error;
    //     }
    //   }
    // }

    // return totalCount;
    // Parallelize all section fetches
    const allItemsPromises = version.modules.flatMap(module =>
      module.sections.map(section =>
        this.readItemsGroup(section.itemsGroupId.toString(), session)
          .then(group => group.items.length)
          .catch(err =>
            err instanceof NotFoundError ? 0 : Promise.reject(err),
          ),
      ),
    );

    const itemsCounts = await Promise.all(allItemsPromises);

    return itemsCounts.reduce((sum, count) => sum + count, 0);
  }

  async getTotalItemsCount(
    courseId: string,
    versionId: string,
    session?: ClientSession,
  ): Promise<number> {
    await this.init();

    const version = await this.courseRepo.readVersion(versionId, session);
    if (!version) {
      throw new NotFoundError(`Course version ${versionId} not found.`);
    }
    // Verify that the version belongs to the specified course
    if (version.courseId.toString() !== courseId) {
      throw new NotFoundError(
        `Version ${versionId} does not belong to course ${courseId}.`,
      );
    }
    if (version.totalItems) {
      return version.totalItems;
    } else {
      // If totalItems is not set, calculate it
      version.totalItems = await this.CalculateTotalItemsCount(
        courseId,
        versionId,
        session,
      );

      // Update the version with the calculated totalItems
      const updatedVersion = await this.courseRepo.updateVersion(
        versionId,
        version,
        session,
      );
      if (!updatedVersion) {
        throw new InternalServerError(
          `Failed to update version ${versionId} with total items count.`,
        );
      }
      return updatedVersion.totalItems;
    }
  }

  private async deleteAndReturnIds(
    collection: Collection<any>,
    filter: any,
    session?: ClientSession,
  ): Promise<ObjectId[]> {
    const docs = await collection
      .find(filter, { projection: { _id: 1 }, session })
      .toArray();

    if (docs.length === 0) return [];

    const ids = docs.map(doc => doc._id);
    await collection.deleteMany({ _id: { $in: ids } }, { session });

    return ids;
  }

  async cascadeDeleteItem(session?: ClientSession): Promise<void> {
    // Top down leaf first cascade delete
    await this.init();
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // 1. Delete quizzes marked as deleted
      const deletedFilter = { isDeleted: true, deletedAt: { $lte: thirtyDaysAgo } };

      // start with questions.
      const deletedQuestionsIds = await this.deleteAndReturnIds(
        this.questionsCollection,
        deletedFilter,
        session,
      );

      // pull the question ids from question banks
      if (deletedQuestionsIds.length > 0) {
        await this.questionBankCollection.updateMany(
          { questions: { $in: deletedQuestionsIds } },
          { $pullAll: { questions: deletedQuestionsIds } },
          { session },
        );
      }

      // 2. Delete question banks marked as deleted
      const deletedQuestionBankIds = await this.deleteAndReturnIds(
        this.questionBankCollection,
        deletedFilter,
        session,
      );

      // pull the question bank ids from quizzes
      if (deletedQuestionBankIds.length > 0) {
        await this.quizCollection.updateMany(
          { 'details.questionBankRefs.bankId': { $in: deletedQuestionBankIds } },
          {
            $pull: {
              'details.questionBankRefs': {
                bankId: { $in: deletedQuestionBankIds },
              },
            },
          },
          { session },
        );
      }

      // ItemsGroup -> items (parent soft deletion doesn't flag child as deleted)
      // So we need to hard delete the child items here.

      const deletedItemGroups = await this.itemsGroupCollection
        .find(deletedFilter)
        .toArray();

      const itemMap: Record<ItemType, ObjectId[]> = {
        [ItemType.VIDEO]: [],
        [ItemType.QUIZ]: [],
        [ItemType.BLOG]: [],
        [ItemType.PROJECT]: [],
        [ItemType.FEEDBACK]: [],
      };

      for (const group of deletedItemGroups) {
        for (const item of group.items) {
          itemMap[item.type].push(new ObjectId(item._id));
        }
      }

      // 3. Delete Independedly soft deleted items.
      const deletedQuizIds = await this.deleteAndReturnIds(
        this.quizCollection,
        { ...deletedFilter, _id: { $in: itemMap[ItemType.QUIZ] } },
        session,
      );

      const deletedVideoIds = await this.deleteAndReturnIds(
        this.videoCollection,
        { ...deletedFilter, _id: { $in: itemMap[ItemType.VIDEO] } },
        session,
      );

      const deletedBlogIds = await this.deleteAndReturnIds(
        this.blogCollection,
        { ...deletedFilter, _id: { $in: itemMap[ItemType.BLOG] } },
        session,
      );

      const deletedProjectIds = await this.deleteAndReturnIds(
        this.projectCollection,
        { ...deletedFilter, _id: { $in: itemMap[ItemType.PROJECT] } },
        session,
      );

      // pull the items from items groups
      const allDeletedItemIds = [
        ...deletedQuizIds,
        ...deletedVideoIds,
        ...deletedBlogIds,
        ...deletedProjectIds,
      ];

      if (allDeletedItemIds.length > 0) {
        await this.itemsGroupCollection.updateMany(
          { 'items._id': { $in: allDeletedItemIds } },
          { $pull: { items: { _id: { $in: allDeletedItemIds } } } },
          { session },
        );
      }

      await this.courseRepo.cascadeDeleteVersion(session);
    } catch (error) {
      console.error('Cascade delete failure:', error);
    }
  }

  async getItemGroupsByIds(
    itemGroupIds: string[],
    session?: ClientSession,
  ): Promise<ItemsGroup[]> {
    await this.init();

    const objectIds = itemGroupIds.map(id => new ObjectId(id));
    const itemGroups = await this.itemsGroupCollection
      .find({ _id: { $in: objectIds } }, { session })
      .toArray();

    return itemGroups.map(ig =>
      instanceToPlain(Object.assign(new ItemsGroup(), ig)),
    ) as ItemsGroup[];
  }

  async updateItemsGroupsBulk(
    itemGroups: ItemsGroup[],
    session?: ClientSession,
  ): Promise<number> {
    await this.init();

    const bulkOps = itemGroups.map(group => ({
      replaceOne: {
        filter: { _id: new ObjectId(group._id) },
        replacement: group,
        upsert: true,
      },
    }));

    const result = await this.itemsGroupCollection.bulkWrite(bulkOps, {
      session,
    });

    return result.modifiedCount;
  }

  async updateItemById(
    itemId: string,
    item: Item,
    itemType: string,
    session?: ClientSession,
  ): Promise<Item> {
    await this.init();
    let collection: Collection<any>;
    switch (itemType) {
      case ItemType.VIDEO:
        collection = this.videoCollection;
        break;
      case ItemType.QUIZ:
        collection = this.quizCollection;
        break;
      case ItemType.BLOG:
        collection = this.blogCollection;
        break;
      case ItemType.PROJECT:
        collection = this.projectCollection;
        break;
      case ItemType.FEEDBACK:
        collection = this.feedbackFormCollection;
        break;
      default:
        throw new InternalServerError(
          `Unsupported item type: ${(item as any).type}`,
        );
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(itemId) },
      { $set: item },
      { session, returnDocument: 'after' },
    );

    if (!result) {
      throw new NotFoundError(`Item ${itemId} not found.`);
    }

    return result as Item;
  }

  async calculateItemCountsForVersion(
    courseVersionId: string,
    session?: ClientSession,
  ): Promise<{
    totalItems: number;
    itemCounts: Record<string, number>;
  }> {
    await this.init();
    // 1️⃣ Load version (modules + sections embedded)
    const courseVersion = await this.courseRepo.readVersion(
      courseVersionId,
      session,
    );
    if (!courseVersion) {
      throw new Error(`CourseVersion ${courseVersionId} not found`);
    }

    // 2️⃣ Collect all itemsGroupIds
    const itemsGroupIds: ObjectId[] = [];

    for (const module of courseVersion.modules ?? []) {
      if (module.isHidden || module.isDeleted) continue;
      for (const section of module.sections ?? []) {
        if (section.itemsGroupId && !section.isDeleted) {
          itemsGroupIds.push(new ObjectId(section.itemsGroupId));
        }
      }
    }

    if (!itemsGroupIds.length) {
      return { totalItems: 0, itemCounts: {} };
    }

    // 3️⃣ Aggregate from ItemsGroup
    const result = await this.itemsGroupCollection
      .aggregate(
        [
          {
            $match: {
              _id: { $in: itemsGroupIds },
              isHidden: { $ne: true }
            },
          },
          { $unwind: '$items' },
          {
            $match: {
              'items.isHidden': { $ne: true }
            }
          },
          {
            $group: {
              _id: '$items.type',
              count: { $sum: 1 },
            },
          },
        ],
        { session },
      )
      .toArray();

    // 4️⃣ Build response
    const itemCounts: Record<string, number> = {};
    let totalItems = 0;

    for (const row of result) {
      itemCounts[row._id] = row.count;
      totalItems += row.count;
    }

    return { totalItems, itemCounts };
  }






}
