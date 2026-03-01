import { IActivityRepository } from "#root/modules/hpSystem/interfaces/IActivityRepository.js";
import { HpActivity, HpActivitySubmission } from "#root/modules/hpSystem/models.js";
import { MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
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

    async createActivity(payload: Partial<HpActivity>, session?: ClientSession): Promise<HpActivity> {
        const now = new Date();

        const docToInsert: HpActivity = {
            ...(payload as HpActivity),
            createdAt: (payload as HpActivity)?.createdAt ?? now,
            updatedAt: (payload as HpActivity)?.updatedAt ?? now,
        };

        await this.hpActivityCollection.insertOne(
            docToInsert,
            session ? { session } : undefined,
        );

        return docToInsert;
    }

    async updateActivityById(
        activityId: string,
        update: Partial<HpActivity>,
        session?: ClientSession,
    ): Promise<HpActivity | null> {
        return await this.hpActivityCollection.findOneAndUpdate(
            { _id: new ObjectId(activityId) },
            { $set: { ...update, updatedAt: new Date() } },
            {
                ...(session ? { session } : {}),
                returnDocument: "after",
            },
        );

    }

    async findById(activityId: string): Promise<HpActivity | null> {
        return this.hpActivityCollection.findOne({ _id: new ObjectId(activityId) });
    }

    async listActivities(filters: {
        courseId?: string;
        courseVersionId?: string;
        Cohort?: string;
        status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
        createdByTeacherId?: string;
    }): Promise<HpActivity[]> {
        const q: any = {};

        if (filters.courseId) q.courseId = new ObjectId(filters.courseId);
        if (filters.courseVersionId) q.courseVersionId = new ObjectId(filters.courseVersionId);
        if (filters.Cohort) q.Cohort = filters.Cohort;
        if (filters.status) q.status = filters.status;
        if (filters.createdByTeacherId) q.createdByTeacherId = new ObjectId(filters.createdByTeacherId);

        return this.hpActivityCollection
            .find(q)
            .sort({ createdAt: -1 })
            .toArray();
    }

    async publishActivity(
        activityId: string,
        teacherId: string,
        session?: ClientSession,
    ): Promise<HpActivity | null> {
        return await this.hpActivityCollection.findOneAndUpdate(
            { _id: new ObjectId(activityId), status: { $ne: "ARCHIVED" } },
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
        return await this.hpActivityCollection.findOneAndUpdate(
            { _id: new ObjectId(activityId) },
            { $set: { status: "ARCHIVED", updatedAt: new Date() } },
            {
                ...(session ? { session } : {}),
                returnDocument: "after",
            },
        );

    }
}