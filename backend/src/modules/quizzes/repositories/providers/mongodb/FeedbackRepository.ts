import {injectable, inject} from 'inversify';
import {Collection, ClientSession, ObjectId} from 'mongodb';
import {MongoDatabase} from '#shared/database/providers/mongo/MongoDatabase.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {
  FeedBackFormItem,
  FeedbackSubmissionItem,
} from '#root/modules/courses/classes/index.js';
import {InternalServerError} from 'routing-controllers';

@injectable()
class FeedbackRepository {
  private feedbackSubmissionCollection: Collection<FeedbackSubmissionItem>;
  private feedbackFormCollection: Collection<FeedBackFormItem>;
  private initialized = false;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this.feedbackSubmissionCollection =
      await this.db.getCollection<FeedbackSubmissionItem>(
        'feedback_submission',
      );

    this.feedbackFormCollection =
      await this.db.getCollection<FeedBackFormItem>('feedback_forms');

    if (this.initialized) return;
    this.initialized = true;

    // feedback_submission had no indexes at all, so every lookup by user or
    // version was a full collection scan. Progress recalculation reads this
    // collection once per item create/delete on the Guru Setu course.
    try {
      await this.feedbackSubmissionCollection.createIndex(
        {courseVersionId: 1, userId: 1},
        {background: true},
      );
    } catch (e) {
      // Index already exists
    }
    // Current-answer lookups: one student's submissions to one form, newest first.
    try {
      await this.feedbackSubmissionCollection.createIndex(
        {feedbackFormId: 1, userId: 1, createdAt: -1},
        {background: true},
      );
    } catch (e) {
      // Index already exists
    }
  }

  /**
   * Ranks each student's submissions to a form, newest first. "Newest" is the
   * most recently inserted (ObjectId order, which follows insert time).
   * Rank 1 is the current answer. Works for submissions
   * written before the isCurrent flag existed, so old duplicates need no
   * migration. Cohort is not part of the identity: older submissions have none.
   */
  static versionStages(): any[] {
    return [
      {
        $setWindowFields: {
          partitionBy: {u: '$userId', f: '$feedbackFormId'},
          sortBy: {_id: -1},
          output: {versionRank: {$documentNumber: {}}},
        },
      },
      {$addFields: {isCurrentVersion: {$eq: ['$versionRank', 1]}}},
    ];
  }

  /** Marks a student's earlier answers to a form as replaced (before inserting the new one). */
  async markReplaced(
    userId: string,
    feedbackFormId: string,
    session?: ClientSession,
  ): Promise<number> {
    await this.init();
    const result = await this.feedbackSubmissionCollection.updateMany(
      {
        userId: new ObjectId(userId),
        feedbackFormId: new ObjectId(feedbackFormId),
        isCurrent: {$ne: false},
      },
      {$set: {isCurrent: false, replacedAt: new Date()}},
      {session},
    );
    return result.modifiedCount ?? 0;
  }

  /** A student's current answer to a form, or null. */
  async findCurrentForUser(
    userId: string,
    feedbackFormId: string,
    session?: ClientSession,
  ): Promise<FeedbackSubmissionItem | null> {
    await this.init();
    const [latest] = await this.feedbackSubmissionCollection
      .find(
        {
          userId: new ObjectId(userId),
          feedbackFormId: new ObjectId(feedbackFormId),
        },
        {session},
      )
      .sort({_id: -1})
      .limit(1)
      .toArray();
    return latest ?? null;
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

  async getByUserAndVersionId(
    userId: string,
    versionId: string,
    session?: ClientSession,
  ): Promise<FeedbackSubmissionItem> {
    await this.init();
    return await this.feedbackSubmissionCollection.findOne(
      {
        userId: new ObjectId(userId),
        courseVersionId: new ObjectId(versionId),
      },
      {session},
    );
  }

  async getAllByUserAndVersionId(
    userId: string,
    versionId: string,
    session?: ClientSession,
  ): Promise<FeedbackSubmissionItem[]> {
    await this.init();
    return await this.feedbackSubmissionCollection.find(
      {
        userId: new ObjectId(userId),
        courseVersionId: new ObjectId(versionId),
      },
      {session},
    ).toArray();
  }

  /**
   * All submissions in a course version, across every user. Used by bulk
   * progress recalculation so it can fetch once instead of once per
   * enrollment.
   */
  async getAllByVersionId(
    versionId: string,
    session?: ClientSession,
  ): Promise<FeedbackSubmissionItem[]> {
    await this.init();
    return await this.feedbackSubmissionCollection
      .find({courseVersionId: new ObjectId(versionId)}, {session})
      .toArray();
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

  async deleteSubmissionsByFormId(
    formId: string,
    session?: ClientSession,
  ): Promise<number> {
    await this.init();

    const result = await this.feedbackSubmissionCollection.deleteMany(
      {feedbackFormId: new ObjectId(formId)},
      {session},
    );

    return result.deletedCount ?? 0;
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
    cohortId?: string,
    session?: ClientSession,
  ): Promise<FeedbackSubmissionItem | null> {
    await this.init();

    const result = await this.feedbackSubmissionCollection.findOne(
      {userId, previousItemId, cohortId},
      {session},
    );

    return result ?? null;
  }

  /** The lookups that attach the lesson a form is about as `previousItem`. */
  private static previousItemStages(): any[] {
    const lookup = (from: string, as: string) => ({
      $lookup: {from, localField: 'previousItemId', foreignField: '_id', as},
    });
    return [
      lookup('videos', 'videoItem'),
      lookup('quizzes', 'quizItem'),
      lookup('blogs', 'blogItem'),
      lookup('projects', 'projectItem'),
      {
        $addFields: {
          previousItem: {
            $switch: {
              branches: [
                {
                  case: {$eq: ['$previousItemType', 'VIDEO']},
                  then: {$arrayElemAt: ['$videoItem', 0]},
                },
                {
                  case: {$eq: ['$previousItemType', 'QUIZ']},
                  then: {$arrayElemAt: ['$quizItem', 0]},
                },
                {
                  case: {$eq: ['$previousItemType', 'BLOG']},
                  then: {$arrayElemAt: ['$blogItem', 0]},
                },
                {
                  case: {$eq: ['$previousItemType', 'PROJECT']},
                  then: {$arrayElemAt: ['$projectItem', 0]},
                },
              ],
              default: null,
            },
          },
        },
      },
      {$project: {videoItem: 0, quizItem: 0, blogItem: 0, projectItem: 0}},
    ];
  }

  private async labelMapFor(feedbackFormId: string) {
    const feedbackForm = await this.feedbackFormCollection.findOne({
      _id: new ObjectId(feedbackFormId),
    });
    const schema = feedbackForm?.details?.jsonSchema;
    const labelMap: Record<string, Record<string, string>> = {};
    if (schema?.properties) {
      Object.entries(schema.properties).forEach(
        ([fieldName, fieldSchema]: any) => {
          labelMap[fieldName] = {};
          if (fieldSchema.oneOf) {
            fieldSchema.oneOf.forEach((opt: any) => {
              labelMap[fieldName][opt.const] = opt.title;
            });
            return;
          }
          // Older forms: enum only
          if (fieldSchema.enum) {
            // Values may be numbers (a linear scale's enum is 1..N).
            fieldSchema.enum.forEach((raw: unknown) => {
              const val = String(raw);
              labelMap[fieldName][val] = val
                .replace(/[_-]/g, ' ')
                .replace(/\b\w/g, (l: string) => l.toUpperCase());
            });
          }
        },
      );
    }
    return labelMap;
  }

  /**
   * A form's responses, newest first. By default only each student's current
   * answer; `history: 'all'` includes replaced ones (each marked with
   * isCurrentVersion). Search matches first name, last name, full name or email.
   */
  async getFeedbackSubmissionById(
    feedbackFormId: string,
    courseId: string,
    search: string,
    page: number,
    limit: number,
    options: {
      userId?: string;
      cohortIds?: string[];
      history?: 'latest' | 'all';
    } = {},
  ) {
    await this.init();
    const skip = (page - 1) * limit;
    const labelMap = await this.labelMapFor(feedbackFormId);
    const term = search?.trim();
    const escaped = term ? term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';

    try {
      const pipeline: any[] = [
        {
          $match: {
            feedbackFormId: new ObjectId(feedbackFormId),
            courseId: new ObjectId(courseId),
            ...(options.userId ? {userId: new ObjectId(options.userId)} : {}),
          },
        },
        ...FeedbackRepository.versionStages(),
        ...(options.history === 'all'
          ? []
          : [{$match: {isCurrentVersion: true}}]),
        ...(options.cohortIds
          ? [
              {
                $match: {
                  cohortId: {
                    $in: options.cohortIds.map(id => new ObjectId(id)),
                  },
                },
              },
            ]
          : []),
        {$sort: {createdAt: -1, _id: -1}},
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        {$unwind: '$user'},
        ...(term
          ? [
              {
                $match: {
                  $or: [
                    {'user.firstName': {$regex: escaped, $options: 'i'}},
                    {'user.lastName': {$regex: escaped, $options: 'i'}},
                    {'user.email': {$regex: escaped, $options: 'i'}},
                    {
                      $expr: {
                        $regexMatch: {
                          input: {
                            $concat: [
                              {$ifNull: ['$user.firstName', '']},
                              ' ',
                              {$ifNull: ['$user.lastName', '']},
                            ],
                          },
                          regex: escaped,
                          options: 'i',
                        },
                      },
                    },
                  ],
                },
              },
            ]
          : []),
      ];

      const [countResult] = await this.feedbackSubmissionCollection
        .aggregate([...pipeline, {$count: 'total'}])
        .toArray();
      const total = countResult?.total || 0;

      const submissions = await this.feedbackSubmissionCollection
        .aggregate([
          ...pipeline,
          {$skip: skip},
          {$limit: limit},
          ...FeedbackRepository.previousItemStages(),
          {$project: {versionRank: 0, 'user.password': 0}},
        ])
        .toArray();

      submissions.forEach(sub => {
        if (!sub.details) return;
        Object.entries(sub.details).forEach(([field, value]) => {
          const map = labelMap[field];
          const stringValue = String(value);
          if (map && map[stringValue]) {
            sub.details[field] = map[stringValue];
          }
        });
      });

      return {
        submissions,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      throw new InternalServerError(
        `Failed to get Feedback submission for form ${feedbackFormId}`,
      );
    }
  }

  /** Current answers' details for a form (newest first), for the summary. */
  async getCurrentAnswerDetails(
    feedbackFormId: string,
    courseId: string,
    cohortIds?: string[],
  ): Promise<Record<string, unknown>[]> {
    await this.init();
    const rows = await this.feedbackSubmissionCollection
      .aggregate([
        {
          $match: {
            feedbackFormId: new ObjectId(feedbackFormId),
            courseId: new ObjectId(courseId),
          },
        },
        ...FeedbackRepository.versionStages(),
        {
          $match: {
            isCurrentVersion: true,
            ...(cohortIds
              ? {cohortId: {$in: cohortIds.map(id => new ObjectId(id))}}
              : {}),
          },
        },
        {$sort: {createdAt: -1, _id: -1}},
        {$project: {details: 1}},
      ])
      .toArray();
    return rows.map(r => (r.details ?? {}) as Record<string, unknown>);
  }

  /** Current answers per form (form id -> count), for the course feedback list. */
  async countCurrentByForm(
    feedbackFormIds: string[],
    courseVersionId: string,
    cohortIds?: string[],
  ): Promise<Map<string, number>> {
    await this.init();
    if (!feedbackFormIds.length) return new Map();
    const rows = await this.feedbackSubmissionCollection
      .aggregate([
        {
          $match: {
            feedbackFormId: {$in: feedbackFormIds.map(id => new ObjectId(id))},
            courseVersionId: new ObjectId(courseVersionId),
          },
        },
        ...FeedbackRepository.versionStages(),
        {
          $match: {
            isCurrentVersion: true,
            ...(cohortIds
              ? {cohortId: {$in: cohortIds.map(id => new ObjectId(id))}}
              : {}),
          },
        },
        {$group: {_id: '$feedbackFormId', count: {$sum: 1}}},
      ])
      .toArray();
    return new Map(rows.map(r => [r._id.toString(), r.count as number]));
  }

  /** Every submission (all versions) for a set of forms, oldest first, for exports. */
  async getSubmissionsForForms(
    feedbackFormIds: string[],
    courseVersionId: string,
    cohortIds?: string[],
  ): Promise<(FeedbackSubmissionItem & {isCurrentVersion: boolean})[]> {
    await this.init();
    if (!feedbackFormIds.length) return [];
    return (await this.feedbackSubmissionCollection
      .aggregate([
        {
          $match: {
            feedbackFormId: {$in: feedbackFormIds.map(id => new ObjectId(id))},
            courseVersionId: new ObjectId(courseVersionId),
          },
        },
        ...FeedbackRepository.versionStages(),
        ...(cohortIds
          ? [{$match: {cohortId: {$in: cohortIds.map(id => new ObjectId(id))}}}]
          : []),
        {$sort: {createdAt: 1, _id: 1}},
        {$project: {versionRank: 0}},
      ])
      .toArray()) as any;
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
