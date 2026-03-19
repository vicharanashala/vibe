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

    listActivities(filters: {
        courseId?: string;
        courseVersionId?: string;
        cohort?: string;
        status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
        createdByTeacherId?: string;
    }, role?: EnrollmentRole): Promise<HpActivityTransformer[]>;

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

    getCountByCohortName(cohortName: string, courseVersionId?: string): Promise<number>;
    getDraftCountByCohortName(cohortName: string, courseVersionId?: string): Promise<number>;
    getPublishedCountByCohortName(cohortName: string, courseVersionId?: string): Promise<number>;
}