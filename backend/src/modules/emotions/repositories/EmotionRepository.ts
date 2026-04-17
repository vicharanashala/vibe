import { inject, injectable } from 'inversify';
import { Collection, ObjectId } from 'mongodb';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { IEmotionSubmission, EmotionType } from '../types.js';

type EmotionDocument = {
  _id?: ObjectId;
  studentId: ObjectId;
  courseId: ObjectId;
  courseVersionId: ObjectId;
  itemId: ObjectId;
  emotion: EmotionType;
  feedbackText?: string;
  timestamp: Date;
  cohortId?: ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

type ItemsGroupDocument = {
  _id: ObjectId;
  items?: Array<{
    _id?: ObjectId | string;
    name?: string;
    type?: string;
    order?: string;
  }>;
};

type EmotionItemRef = {
  itemId: string;
  name: string;
  type?: string;
  order?: string;
};

@injectable()
export class EmotionRepository {
  private emotionCollection: Collection<EmotionDocument>;
  private itemsGroupCollection: Collection<ItemsGroupDocument>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private readonly db: MongoDatabase,
  ) {}

  private async init() {
    if (!this.emotionCollection) {
      this.emotionCollection = await this.db.getCollection<EmotionDocument>(
        'emotions',
      );
      this.itemsGroupCollection = await this.db.getCollection<ItemsGroupDocument>(
        'itemsGroup',
      );
      await this.emotionCollection.createIndex({ studentId: 1, courseId: 1 });
      await this.emotionCollection.createIndex({ itemId: 1 });
      await this.emotionCollection.createIndex({ courseVersionId: 1 });
      await this.emotionCollection.createIndex({ createdAt: -1 });
    }
  }

  private normalizeEmotion(document: EmotionDocument | null): IEmotionSubmission | null {
    if (!document) {
      return null;
    }

    return {
      _id: document._id?.toString(),
      studentId: document.studentId.toString(),
      courseId: document.courseId.toString(),
      courseVersionId: document.courseVersionId.toString(),
      itemId: document.itemId.toString(),
      emotion: document.emotion,
      feedbackText: document.feedbackText,
      timestamp: document.timestamp,
      cohortId: document.cohortId?.toString(),
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }

  private toObjectId(id: string): ObjectId {
    return new ObjectId(id);
  }

  /**
   * Create a new emotion submission
   */
  async createEmotion(emotionData: IEmotionSubmission): Promise<IEmotionSubmission> {
    await this.init();

    const now = new Date();
    const document: EmotionDocument = {
      studentId: this.toObjectId(emotionData.studentId),
      courseId: this.toObjectId(emotionData.courseId),
      courseVersionId: this.toObjectId(emotionData.courseVersionId),
      itemId: this.toObjectId(emotionData.itemId),
      emotion: emotionData.emotion,
      feedbackText: emotionData.feedbackText,
      timestamp: emotionData.timestamp ?? now,
      cohortId: emotionData.cohortId ? this.toObjectId(emotionData.cohortId) : undefined,
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.emotionCollection.insertOne(document);
    return {
      ...emotionData,
      _id: result.insertedId.toString(),
      timestamp: document.timestamp,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }

  /**
   * Get emotion submission by ID
   */
  async getEmotionById(id: string): Promise<IEmotionSubmission | null> {
    await this.init();
    return this.normalizeEmotion(
      await this.emotionCollection.findOne({ _id: this.toObjectId(id) }),
    );
  }

  /**
   * Get emotions for a specific student and item
   */
  async getEmotionsByStudentAndItem(studentId: string, itemId: string): Promise<IEmotionSubmission | null> {
    await this.init();
    return this.normalizeEmotion(
      await this.emotionCollection.findOne({
        studentId: this.toObjectId(studentId),
        itemId: this.toObjectId(itemId),
      }),
    );
  }

  /**
   * Update emotion for a student on a specific item
   */
  async updateEmotion(
    studentId: string,
    itemId: string,
    emotion: EmotionType,
    feedbackText?: string
  ): Promise<IEmotionSubmission | null> {
    await this.init();
    const now = new Date();
    const setPayload: Partial<EmotionDocument> = {
      emotion,
      timestamp: now,
      updatedAt: now,
    };

    if (feedbackText !== undefined) {
      setPayload.feedbackText = feedbackText;
    }

    const updated = await this.emotionCollection.findOneAndUpdate(
      {
        studentId: this.toObjectId(studentId),
        itemId: this.toObjectId(itemId),
      },
      {
        $set: setPayload,
      },
      { returnDocument: 'after' },
    );

    return this.normalizeEmotion(updated);
  }

  /**
   * Get emotion statistics for an item
   */
  async getEmotionStats(itemId: string): Promise<Array<{ _id: EmotionType; count: number }>> {
    await this.init();
    return this.emotionCollection.aggregate<{ _id: EmotionType; count: number }>([
      { $match: { itemId: this.toObjectId(itemId) } },
      {
        $group: {
          _id: "$emotion",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]).toArray();
  }

  /**
   * Get emotion history for a student in a course
   */
  async getEmotionHistory(
    studentId: string,
    courseId: string,
    courseVersionId: string,
    limit: number = 50
  ): Promise<IEmotionSubmission[]> {
    await this.init();
    const results = await this.emotionCollection
      .find({
        studentId: this.toObjectId(studentId),
        courseId: this.toObjectId(courseId),
        courseVersionId: this.toObjectId(courseVersionId),
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return results
      .map(result => this.normalizeEmotion(result))
      .filter((result): result is IEmotionSubmission => result !== null);
  }

  /**
   * Get all emotions for a course
   */
  async getEmotionsForCourse(courseId: string, courseVersionId: string): Promise<IEmotionSubmission[]> {
    await this.init();
    const results = await this.emotionCollection
      .find({
        courseId: this.toObjectId(courseId),
        courseVersionId: this.toObjectId(courseVersionId),
      })
      .toArray();

    return results
      .map(result => this.normalizeEmotion(result))
      .filter((result): result is IEmotionSubmission => result !== null);
  }

  /**
   * Get emotion distribution for a course
   */
  async getEmotionDistribution(courseId: string, courseVersionId: string) {
    await this.init();
    return this.emotionCollection.aggregate<{ _id: EmotionType; count: number }>([
      {
        $match: {
          courseId: this.toObjectId(courseId),
          courseVersionId: this.toObjectId(courseVersionId),
        },
      },
      {
        $group: {
          _id: "$emotion",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]).toArray();
  }

  /**
   * Resolve all item IDs grouped under itemsGroup IDs.
   */
  async getItemIdsByItemsGroupIds(
    itemsGroupIds: string[],
  ): Promise<Record<string, string[]>> {
    await this.init();

    const validIds = itemsGroupIds.filter(id => ObjectId.isValid(id));
    if (validIds.length === 0) {
      return {};
    }

    const groupObjectIds = validIds.map(id => this.toObjectId(id));
    const groups = await this.itemsGroupCollection
      .find({ _id: { $in: groupObjectIds } }, { projection: { items: 1 } })
      .toArray();

    const mapping: Record<string, string[]> = {};
    groups.forEach(group => {
      mapping[group._id.toString()] = (group.items || [])
        .map(item => item?._id?.toString())
        .filter((id): id is string => Boolean(id));
    });

    return mapping;
  }

  async getItemRefsByItemsGroupIds(
    itemsGroupIds: string[],
  ): Promise<Record<string, EmotionItemRef[]>> {
    await this.init();

    const validIds = itemsGroupIds.filter(id => ObjectId.isValid(id));
    if (validIds.length === 0) {
      return {};
    }

    const groups = await this.itemsGroupCollection
      .find(
        { _id: { $in: validIds.map(id => this.toObjectId(id)) } },
        { projection: { items: 1 } },
      )
      .toArray();

    const mapping: Record<string, EmotionItemRef[]> = {};
    groups.forEach(group => {
      const itemRefs = (group.items || []).reduce<EmotionItemRef[]>((accumulator, item) => {
          const itemId = item?._id?.toString();
          if (!itemId) {
            return accumulator;
          }

          accumulator.push({
            itemId,
            name: item.name || 'Untitled Item',
            type: item.type,
            order: item.order,
          });

          return accumulator;
        }, []);

      mapping[group._id.toString()] = itemRefs;
    });

    return mapping;
  }

  /**
   * Delete emotion by ID
   */
  async deleteEmotion(id: string): Promise<boolean> {
    await this.init();
    const result = await this.emotionCollection.deleteOne({
      _id: this.toObjectId(id),
    });
    return (result.deletedCount ?? 0) > 0;
  }

  /**
   * Delete emotions for a specific item (admin cleanup)
   */
  async deleteEmotionsForItem(itemId: string): Promise<number> {
    await this.init();
    const result = await this.emotionCollection.deleteMany({
      itemId: this.toObjectId(itemId),
    });
    return result.deletedCount ?? 0;
  }
}
