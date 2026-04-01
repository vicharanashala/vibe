import { ClientSession } from "mongodb";
import { HpActivity } from "../models.js";
import { HpActivityTransformer } from "../classes/transformers/Activity.js";
import { EnrollmentRole } from "#root/shared/index.js";


export interface IActivityRepository {
    createActivity(payload: Partial<HpActivity>, session?: ClientSession): Promise<HpActivityTransformer>;

    updateActivityById(
        activityId: string,
        update: Partial<HpActivity>,
        session?: ClientSession,
    ): Promise<HpActivity | null>;

    findById(activityId: string): Promise<HpActivityTransformer | null>;

    deleteById(activityId: string, session?: ClientSession): Promise<void>

    listActivities(filters: {
        courseId?: string;
        courseVersionId?: string;
        cohortId?: string;
        status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
        createdByTeacherId?: string;
    }, role?: EnrollmentRole): Promise<HpActivityTransformer[]>;

    listActivityIds(query: {
        status?: string;
        activityType?: string;
    }): Promise<string[]>

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

    getCountByCohortId(cohortId: string, courseVersionId?: string, session?: ClientSession): Promise<number>;
    getDraftCountByCohortId(cohortId: string, courseVersionId?: string): Promise<number>;
    getPublishedCountByCohortId(cohortId: string, courseVersionId?: string): Promise<number>;
}