import { HpActivityTransformer } from '#root/modules/hpSystem/classes/transformers/Activity.js';
import { ListActivitiesQuery } from '#root/modules/hpSystem/classes/validators/activityValidators.js';
import { IActivityRepository } from '#root/modules/hpSystem/interfaces/IActivityRepository.js';
import { HpActivity, HpActivitySubmission } from '#root/modules/hpSystem/models.js';
import { MongoDatabase } from '#root/shared/index.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { plainToInstance } from 'class-transformer';
import { inject, injectable } from 'inversify';
import { ClientSession, Collection, ObjectId } from 'mongodb';

@injectable()
export class ActivityRepository implements IActivityRepository {
  private hpActivityCollection: Collection<HpActivity>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) { }

  async init() {
    this.hpActivityCollection =
      await this.db.getCollection<HpActivity>('hp_activities');
  }

  async createActivity(
    payload: Partial<HpActivity>,
    session?: ClientSession,
  ): Promise<HpActivityTransformer> {
    await this.init();
    const now = new Date();

    const docToInsert: HpActivity = {
      ...(payload as HpActivity),
      createdAt: (payload as HpActivity)?.createdAt ?? now,
      updatedAt: (payload as HpActivity)?.updatedAt ?? now,
    };

    const result = await this.hpActivityCollection.insertOne(
      docToInsert,
      session ? { session } : undefined,
    );

    docToInsert._id = result.insertedId;

    const transformed = plainToInstance(
      HpActivityTransformer,
      docToInsert as unknown as HpActivity,
      {
        excludeExtraneousValues: true,
        exposeDefaultValues: true,
      },
    );

    transformed._id = result.insertedId;

    return transformed;
  }

  async updateActivityById(
    activityId: string,
    update: Partial<HpActivity>,
    session?: ClientSession,
  ): Promise<HpActivity | null> {
    await this.init();
    return await this.hpActivityCollection.findOneAndUpdate(
      { _id: new ObjectId(activityId), isDeleted: { $ne: true } },
      { $set: { ...update, updatedAt: new Date() } },
      {
        ...(session ? { session } : {}),
        returnDocument: 'after',
      },
    );
  }

  async findById(activityId: string): Promise<HpActivityTransformer | null> {
    await this.init();
    const doc = await this.hpActivityCollection.findOne({
      _id: new ObjectId(activityId),
      isDeleted: { $ne: true },
    });
    return plainToInstance(HpActivityTransformer, doc);
  }

  async listActivities(
    filters: ListActivitiesQuery,
    userId?: string,
  ): Promise<HpActivityTransformer[]> {
    await this.init();
    const q: any = { isDeleted: { $ne: true } };

    if (filters.courseId) q.courseId = new ObjectId(filters.courseId);
    if (filters.courseVersionId)
      q.courseVersionId = new ObjectId(filters.courseVersionId);
    if (filters.cohortId) q.cohortId = new ObjectId(filters.cohortId);
    if (filters.status) q.status = filters.status;
    if (filters.activity) q.activityType = filters.activity;
    if (filters.createdByTeacherId)
      q.createdByTeacherId = new ObjectId(filters.createdByTeacherId);
    if (filters.search) {
      q.$or = [
        { title: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
        { activityType: { $regex: filters.search, $options: 'i' } },
      ];
    }

    const docs = await this.hpActivityCollection
      .aggregate([
        { $match: q },

        {
          $lookup: {
            from: 'hp_activity_rules',
            let: { activityId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ['$activityId', '$$activityId'],
                  },
                },
              },
              {
                $project: {
                  _id: 0,
                  isMandatory: 1,
                  deadlineAt: 1,
                  allowLateSubmission: 1,
                },
              },
            ],
            as: 'rules',
          },
        },

        {
          $unwind: {
            path: '$rules',
            preserveNullAndEmptyArrays: true,
          },
        },

        {
          $lookup: {
            from: "hp_activity_submissions",
            let: { activityId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$activityId", "$$activityId"] },
                      ...(userId ? [{ $eq: ["$studentId", new ObjectId(userId)] }] : [])
                    ]
                  }
                }
              },
              { $limit: 1 }
            ],
            as: "submission"
          }
        },
        {
          $unwind: {
            path: "$submission",
            preserveNullAndEmptyArrays: true
          }
        },

        {
          $lookup: {
            from: 'users',
            localField: 'publishedByTeacherId',
            foreignField: '_id',
            as: 'instructor',
          },
        },

        {
          $unwind: {
            path: '$instructor',
            preserveNullAndEmptyArrays: true,
          },
        },

        { $sort: { createdAt: -1 } },
      ])
      .toArray();

    return docs.map(doc => {
      const activity = new HpActivityTransformer();

      activity._id = doc._id;
      activity.courseId = doc.courseId;
      activity.courseVersionId = doc.courseVersionId;
      activity.cohort = doc.cohort;
      activity.title = doc.title;
      activity.description = doc.description;
      activity.status = doc.status;
      activity.createdByTeacherId = doc.createdByTeacherId;
      activity.title = doc.title;
      activity.description = doc.description;
      activity.activityType = doc.activityType;
      activity.submissionMode = doc.submissionMode;
      activity.externalLink = doc.externalLink;
      activity.attachments = doc.attachments;
      activity.required_percentage = doc?.required_percentage

      if (doc.instructor) {
        const firstName = doc.instructor.firstName || '';
        const lastName = doc.instructor.lastName || '';
        activity.instructorName =
          `${firstName} ${lastName}`.trim() || undefined;
      }
      activity.createdAt = doc.createdAt;

      if (doc.rules) {
        activity.rules = {
          isMandatory: doc.rules.isMandatory,
          deadlineAt: doc.rules.deadlineAt,
          allowLateSubmission: doc.rules.allowLateSubmission,
        };
      }

      if (doc.stats) {
        activity.stats = {
          totalStudents: doc.stats.totalStudents,
          submittedCount: doc.stats.submittedCount,
          completedCount: doc.stats.completedCount,
          overdueCount: doc.stats.overdueCount,
          lastRecomputedAt: doc.stats.lastRecomputedAt,
        };
      }

      activity.isSubmitted = !!doc.submission;

      return activity;
    });
  }

  async listActivityIds(query: {
    status?: string;
    activityType?: string;
  }): Promise<string[]> {
    await this.init();

    const q: any = {};
    if (query.status) q.status = query.status;
    if (query.activityType) q.activityType = query.activityType;

    const docs = await this.hpActivityCollection
      .find(q, { projection: { _id: 1 } })
      .toArray();

    return docs.map(doc => doc._id.toString());
  }

  async publishActivity(
    activityId: string,
    teacherId: string,
    session?: ClientSession,
  ): Promise<HpActivity | null> {
    await this.init();
    return await this.hpActivityCollection.findOneAndUpdate(
      {
        _id: new ObjectId(activityId),
        isDeleted: { $ne: true },
      },
      {
        $set: {
          status: 'PUBLISHED',
          publishedByTeacherId: new ObjectId(teacherId) as any,
          updatedAt: new Date(),
        },
      },
      {
        ...(session ? { session } : {}),
        returnDocument: 'after',
      },
    );
  }

  async archiveActivity(
    activityId: string,
    session?: ClientSession,
  ): Promise<HpActivity | null> {
    await this.init();
    return await this.hpActivityCollection.findOneAndUpdate(
      { _id: new ObjectId(activityId), isDeleted: { $ne: true } },
      { $set: { status: 'ARCHIVED', updatedAt: new Date() } },
      {
        ...(session ? { session } : {}),
        returnDocument: 'after',
      },
    );
  }

  async softDeleteOne(
    activityId: string,
    deletedByTeacherId?: string,
    session?: ClientSession,
  ): Promise<{ modifiedCount: number }> {
    await this.init();

    const filter: any = {
      _id: new ObjectId(activityId),
      deletedAt: { $exists: false },
    };

    const update: any = {
      $set: {
        deletedAt: new Date(),
        isDeleted: true,
        status: 'ARCHIVED',
      },
    };

    if (deletedByTeacherId) {
      update.$set.deletedByTeacherId = new ObjectId(deletedByTeacherId);
    }

    const res = await this.hpActivityCollection.updateOne(
      filter,
      update,
      session ? { session } : undefined,
    );

    return { modifiedCount: res.modifiedCount ?? 0 };
  }

  async getLatestActivityByCohortId(
    cohortId: string,
  ): Promise<HpActivity | null> {
    await this.init();
    return await this.hpActivityCollection.findOne(
      {
        cohortId: new ObjectId(cohortId),
      },
      { sort: { createdAt: -1 } },
    );
  }

  async getDraftCountByCohortId(cohortId: string, courseVersionId?: string): Promise<number> {
    await this.init();

    const query: any = {
      cohortId: new ObjectId(cohortId),
      status: "DRAFT",
      isDeleted: { $ne: true },
    };

    if (courseVersionId) {
      query.courseVersionId = new ObjectId(courseVersionId);
    }

    return await this.hpActivityCollection.countDocuments(query);
  }
  async getPublishedCountByCohortId(cohortId: string, courseVersionId?: string): Promise<number> {
    await this.init();

    const query: any = {
      cohortId: new ObjectId(cohortId),
      status: "PUBLISHED",
      isDeleted: { $ne: true },
    };

    if (courseVersionId) {
      query.courseVersionId = new ObjectId(courseVersionId);
    }

    return await this.hpActivityCollection.countDocuments(query);
  }

  async getCountByCohortId(cohortId: string, courseVersionId?: string, session?: ClientSession): Promise<number> {
    await this.init();

    const query: any = {
      cohortId: new ObjectId(cohortId),
      isDeleted: { $ne: true },
    };

    if (courseVersionId) {
      query.courseVersionId = new ObjectId(courseVersionId);
    }

    return await this.hpActivityCollection.countDocuments(query, session ? { session } : {});
  }

  async getPendingActivitesCount(
    studentId: string,
    courseId: string,
    courseVersionId: string,
    cohortId: string,
  ): Promise<number> {
    await this.init();

    const result = await this.hpActivityCollection
      .aggregate([
        {
          $match: {
            courseId: new ObjectId(courseId),
            courseVersionId: new ObjectId(courseVersionId),
            isDeleted: { $ne: true },
            cohortId: new ObjectId(cohortId)
          },
        },
        {
          $lookup: {
            from: 'hp_activity_submissions',
            let: { activityId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$activityId', '$$activityId'] },
                      { $eq: ['$studentId', new ObjectId(studentId)] },
                    ],
                  },
                },
              },
            ],
            as: 'submission',
          },
        },
        {
          $match: {
            submission: { $size: 0 },
          },
        },
        {
          $count: 'pendingCount',
        },
      ])
      .toArray();

    return result[0]?.pendingCount ?? 0;
  }

  async deleteById(activityId: string, session?: ClientSession): Promise<void> {
    await this.init()
    await this.hpActivityCollection.deleteOne({ _id: new ObjectId(activityId) }, { session })
  }
}
