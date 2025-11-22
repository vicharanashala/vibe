import {injectable, inject} from 'inversify';
import {Collection, ClientSession, ObjectId} from 'mongodb';
import {MongoDatabase} from '#shared/database/providers/mongo/MongoDatabase.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {
  FeedBackFormItem,
  FeedbackSubmissionItem,
} from '#root/modules/courses/classes/index.js';

@injectable()
class FeedbackRepository {
  private feedbackSubmissionCollection: Collection<FeedbackSubmissionItem>;
  private feedbackFormCollection: Collection<FeedBackFormItem>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this.feedbackSubmissionCollection =
      await this.db.getCollection<FeedbackSubmissionItem>(
        'feedback_submission',
      );

    this.feedbackFormCollection = await this.db.getCollection<FeedBackFormItem>(
      'feedback_forms',
    );
  }

  /* ------------------------------------------------------
   * FEEDBACK SUBMISSION OPERATIONS
   * ------------------------------------------------------ */

  async getById(
    feedbackId: string,
    session?: ClientSession,
  ): Promise<FeedbackSubmissionItem | null> {
    await this.init();
    const result = await this.feedbackSubmissionCollection.findOne(
      {_id: new ObjectId(feedbackId)},
      {session},
    );
    return result ?? null;
  }

  async getByIds(
    ids: string[],
    session?: ClientSession,
  ): Promise<FeedbackSubmissionItem[] | null> {
    await this.init();
    const objectIds = ids.map(id => new ObjectId(id));

    const results = await this.feedbackSubmissionCollection
      .find({_id: {$in: objectIds}}, {session})
      .toArray();

    return results.length ? results : null;
  }

  async createFeedback(
    feedback: FeedbackSubmissionItem,
    session?: ClientSession,
  ): Promise<FeedbackSubmissionItem> {
    await this.init();

    const insert = await this.feedbackSubmissionCollection.insertOne(feedback, {
      session,
    });

    return {
      ...feedback,
      _id: insert.insertedId,
    };
  }

  async updateFeedback(
    feedbackId: string,
    updates: Partial<FeedbackSubmissionItem>,
    session?: ClientSession,
  ): Promise<FeedbackSubmissionItem | null> {
    await this.init();

    const result = await this.feedbackSubmissionCollection.findOneAndUpdate(
      {_id: new ObjectId(feedbackId)},
      {$set: updates},
      {returnDocument: 'after', session},
    );

    return result ?? null;
  }

  async findByPreviousItemId(
    previousItemId: string,
    session?: ClientSession,
  ): Promise<FeedbackSubmissionItem[] | null> {
    await this.init();

    const results = await this.feedbackSubmissionCollection
      .find({previousItemId}, {session})
      .toArray();

    return results.length ? results : null;
  }

  async findByUserAndPreviousItem(
    userId: string,
    previousItemId: string,
    session?: ClientSession,
  ): Promise<FeedbackSubmissionItem | null> {
    await this.init();

    const result = await this.feedbackSubmissionCollection.findOne(
      {userId, previousItemId},
      {session},
    );

    return result ?? null;
  }

  /* ------------------------------------------------------
   * FEEDBACK FORM OPERATIONS
   * ------------------------------------------------------ */

  /** Get feedback form by ID */
  async getFormById(
    formId: string,
    session?: ClientSession,
  ): Promise<FeedBackFormItem | null> {
    await this.init();
    return (
      (await this.feedbackFormCollection.findOne(
        {_id: new ObjectId(formId)},
        {session},
      )) ?? null
    );
  }

  /** Get multiple forms */
  async getFormsByIds(
    ids: string[],
    session?: ClientSession,
  ): Promise<FeedBackFormItem[] | null> {
    await this.init();
    const objectIds = ids.map(id => new ObjectId(id));

    const results = await this.feedbackFormCollection
      .find({_id: {$in: objectIds}}, {session})
      .toArray();

    return results.length ? results : null;
  }

  /** Create a feedback form */
  async createForm(
    form: FeedBackFormItem,
    session?: ClientSession,
  ): Promise<FeedBackFormItem> {
    await this.init();

    const insert = await this.feedbackFormCollection.insertOne(form, {
      session,
    });

    return {
      ...form,
      _id: insert.insertedId,
    };
  }

  /** Update a feedback form */
  async updateForm(
    formId: string,
    updates: Partial<FeedBackFormItem>,
    session?: ClientSession,
  ): Promise<FeedBackFormItem | null> {
    await this.init();

    const result = await this.feedbackFormCollection.findOneAndUpdate(
      {_id: new ObjectId(formId)},
      {$set: updates},
      {returnDocument: 'after', session},
    );

    return result ?? null;
  }

  /** Get feedback form linked to a previous item (video/quiz/blog) */
  async findFormByPreviousItemType(
    previousItemType: string,
    session?: ClientSession,
  ): Promise<FeedBackFormItem[] | null> {
    await this.init();

    const results = await this.feedbackFormCollection
      .find({'details.previousItemType': previousItemType}, {session})
      .toArray();

    return results.length ? results : null;
  }

  /** Get feedback form by course and previous item */
  async findFormForCourseItem(
    courseId: string,
    previousItemId: string,
    session?: ClientSession,
  ): Promise<FeedBackFormItem | null> {
    await this.init();

    const result = await this.feedbackFormCollection.findOne(
      {
        courseId,
        'details.previousItemId': previousItemId,
      },
      {session},
    );

    return result ?? null;
  }
}

export {FeedbackRepository};
