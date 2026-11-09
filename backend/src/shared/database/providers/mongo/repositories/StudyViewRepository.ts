import {injectable, inject} from 'inversify';
import {Collection, ObjectId} from 'mongodb';
import {GLOBAL_TYPES} from '#root/types.js';
import {MongoDatabase} from '../MongoDatabase.js';

/**
 * One document per student, course version and lesson they studied in study
 * mode (spec backend/study-progress). Kept apart from progress/watchTime so
 * study mode can never change strict progress.
 */
export interface IStudyView {
  _id?: ObjectId;
  userId: ObjectId;
  courseId: ObjectId;
  courseVersionId: ObjectId;
  itemId: ObjectId;
  firstStudiedAt: Date;
}

@injectable()
export class StudyViewRepository {
  private collection!: Collection<IStudyView>;
  private initialized = false;

  constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

  private async init() {
    if (this.initialized) return;
    this.collection = await this.db.getCollection<IStudyView>('studyViews');
    this.initialized = true;
    try {
      await this.collection.createIndex(
        {userId: 1, courseVersionId: 1, itemId: 1},
        {unique: true, name: 'study_view_unique'},
      );
    } catch (error) {
      // An existing equivalent index is fine; anything else is only logged so
      // a startup race between instances can't take the service down.
      console.error('StudyViewRepository: index creation failed', error);
    }
  }

  /** Records a study view; a repeat keeps the first one (and its time). */
  async recordView(view: {
    userId: string;
    courseId: string;
    courseVersionId: string;
    itemId: string;
  }): Promise<void> {
    await this.init();
    const key = {
      userId: new ObjectId(view.userId),
      courseVersionId: new ObjectId(view.courseVersionId),
      itemId: new ObjectId(view.itemId),
    };
    try {
      await this.collection.updateOne(
        key,
        {
          $setOnInsert: {
            ...key,
            courseId: new ObjectId(view.courseId),
            firstStudiedAt: new Date(),
          },
        },
        {upsert: true},
      );
    } catch (error: any) {
      // Two concurrent first views: the loser hits the unique index, which
      // means the view is already recorded.
      if (error?.code !== 11000) throw error;
    }
  }

  /** Study views of these users for these lessons in a course version. */
  async findViews(
    courseVersionId: string,
    userIds: string[],
    itemIds: string[],
  ): Promise<{userId: string; itemId: string}[]> {
    await this.init();
    if (userIds.length === 0 || itemIds.length === 0) return [];
    const docs = await this.collection
      .find(
        {
          courseVersionId: new ObjectId(courseVersionId),
          userId: {$in: userIds.map(id => new ObjectId(id))},
          itemId: {$in: itemIds.map(id => new ObjectId(id))},
        },
        {projection: {userId: 1, itemId: 1}},
      )
      .toArray();
    return docs.map(d => ({
      userId: d.userId.toString(),
      itemId: d.itemId.toString(),
    }));
  }
}
