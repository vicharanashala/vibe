import { ClientSession } from "mongodb";
import { HpActivity } from "../models.js";
import { HpActivityTransformer } from "../classes/transformers/Activity.js";


export interface IActivityRepository {
    createActivity(payload: Partial<HpActivity>, session?: ClientSession): Promise<HpActivity>;

    updateActivityById(
        activityId: string,
        update: Partial<HpActivity>,
        session?: ClientSession,
    ): Promise<HpActivity | null>;

    findById(activityId: string): Promise<HpActivityTransformer | null>;

    listActivities(filters: {
        courseId?: string;
        courseVersionId?: string;
        cohort?: string;
        status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
        createdByTeacherId?: string;
    }): Promise<HpActivityTransformer[]>;

    publishActivity(
        activityId: string,
        teacherId: string,
        session?: ClientSession,
    ): Promise<HpActivity | null>;

    archiveActivity(activityId: string, session?: ClientSession): Promise<HpActivity | null>;

    softDeleteOne(
        activityId: string,
        deletedByTeacherId?: string,
        session?: ClientSession,
    ): Promise<{ modifiedCount: number }>;
}