import { HpActivityTransformer } from "#root/modules/hpSystem/classes/transformers/Activity.js";
import { IActivityRepository } from "#root/modules/hpSystem/interfaces/IActivityRepository.js";
import { HpActivity } from "#root/modules/hpSystem/models.js";
// import { HpActivity, HpActivitySubmission } from "#root/modules/hpSystem/models.js";
import { MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { plainToInstance } from "class-transformer";
import { inject, injectable } from "inversify";
import { ClientSession, Collection, ObjectId } from "mongodb";

@injectable()
export class ActivityRepository implements IActivityRepository {
    private hpActivityCollection: Collection<HpActivity>;

    constructor(
        @inject(GLOBAL_TYPES.Database)
        private db: MongoDatabase,
    ) { }

    async init() {
        this.hpActivityCollection = await this.db.getCollection<HpActivity>('hp_activities');
    }

    async createActivity(payload: Partial<HpActivity>, session?: ClientSession): Promise<HpActivityTransformer> {
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

        const transformed = plainToInstance(HpActivityTransformer, docToInsert as unknown as HpActivity, {
            excludeExtraneousValues: true,
            exposeDefaultValues: true,
        });

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
                returnDocument: "after",
            },
        );

    }

    async findById(activityId: string): Promise<HpActivityTransformer | null> {
        await this.init();
        const doc = await this.hpActivityCollection.findOne({
            _id: new ObjectId(activityId), isDeleted: { $ne: true },
        });
        return plainToInstance(HpActivityTransformer, doc);
    }

    async listActivities(filters: {
        courseId?: string;
        courseVersionId?: string;
        cohort?: string;
        status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
        createdByTeacherId?: string;
    }): Promise<HpActivityTransformer[]> {
        await this.init();
        const q: any = { isDeleted: { $ne: true } };

        if (filters.courseId) q.courseId = new ObjectId(filters.courseId);
        if (filters.courseVersionId) q.courseVersionId = new ObjectId(filters.courseVersionId);
        if (filters.cohort) q.cohort = filters.cohort;
        if (filters.status) q.status = filters.status;
        if (filters.createdByTeacherId) q.createdByTeacherId = new ObjectId(filters.createdByTeacherId);

        const docs = await this.hpActivityCollection.aggregate([

            { $match: q },

            {
                $lookup: {
                    from: "hp_activity_rules",
                    let: { activityId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $eq: ["$activityId", "$$activityId"]
                                }
                            }
                        },
                        {
                            $project: {
                                _id: 0,
                                isMandatory: 1,
                                deadlineAt: 1,
                                allowLateSubmission: 1
                            }
                        }
                    ],
                    as: "rules"
                }
            },

            {
                $unwind: {
                    path: "$rules",
                    preserveNullAndEmptyArrays: true
                }
            },

            {
                $lookup: {
                    from: "users",
                    localField: "publishedByTeacherId",
                    foreignField: "_id",
                    as: "instructor"
                }
            },

            {
                $unwind: {
                    path: "$instructor",
                    preserveNullAndEmptyArrays: true
                }
            },

            { $sort: { createdAt: -1 } }

        ]).toArray();

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


            if (doc.instructor) {
                const firstName = doc.instructor.firstName || "";
                const lastName = doc.instructor.lastName || "";
                activity.instructorName = `${firstName} ${lastName}`.trim() || undefined;
            }
            activity.createdAt = doc.createdAt;

            if (doc.rules) {
                activity.rules = {
                    isMandatory: doc.rules.isMandatory,
                    deadlineAt: doc.rules.deadlineAt,
                    allowLateSubmission: doc.rules.allowLateSubmission,
                };
            }

            return activity;
        });
    }

    async publishActivity(
        activityId: string,
        teacherId: string,
        session?: ClientSession,
    ): Promise<HpActivity | null> {
        await this.init();
        return await this.hpActivityCollection.findOneAndUpdate(
            {
                _id: new ObjectId(activityId), status: { $ne: "ARCHIVED" },
                isDeleted: { $ne: true },
            },
            {
                $set: {
                    status: "PUBLISHED",
                    publishedByTeacherId: new ObjectId(teacherId) as any,
                    updatedAt: new Date(),
                },
            },
            {
                ...(session ? { session } : {}),
                returnDocument: "after",
            },
        );

    }

    async archiveActivity(activityId: string, session?: ClientSession): Promise<HpActivity | null> {
        await this.init();
        return await this.hpActivityCollection.findOneAndUpdate(
            { _id: new ObjectId(activityId), isDeleted: { $ne: true } },
            { $set: { status: "ARCHIVED", updatedAt: new Date() } },
            {
                ...(session ? { session } : {}),
                returnDocument: "after",
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
                status: "ARCHIVED",
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



    async getLatestActivityByCohortName(cohortName: string): Promise<HpActivity | null> {
        await this.init();
        return await this.hpActivityCollection.findOne({
            cohort: cohortName
        }, { sort: { createdAt: -1 } })
    }


    async getDraftCountByCohortName(cohortName: string): Promise<number> {
        await this.init();
        return await this.hpActivityCollection.countDocuments({
            cohort: cohortName,
            status: "DRAFT",
            isDeleted: { $ne: true },
        });
    }

    async getPublishedCountByCohortName(cohortName: string): Promise<number> {
        await this.init();
        return await this.hpActivityCollection.countDocuments({
            cohort: cohortName,
            status: "PUBLISHED",
            isDeleted: { $ne: true },
        });

    }
    async getCountByCohortName(cohortName: string): Promise<number> {
        await this.init();
        return await this.hpActivityCollection.countDocuments({
            cohort: cohortName,
            isDeleted: { $ne: true },
        });
    }

    async getPendingActivitesCount(
        studentId: string,
        courseId: string,
        courseVersionId: string
    ): Promise<number> {
        await this.init();

        const result = await this.hpActivityCollection.aggregate([
            {
                $match: {
                    courseId: new ObjectId(courseId),
                    courseVersionId: new ObjectId(courseVersionId),
                    isDeleted: { $ne: true },
                }
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
                                        { $eq: ["$studentId", new ObjectId(studentId)] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: "submission"
                }
            },
            {
                $match: {
                    submission: { $size: 0 }
                }
            },
            {
                $count: "pendingCount"
            }
        ]).toArray();

        return result[0]?.pendingCount ?? 0;
    }
}