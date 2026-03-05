import { ClientSession } from "mongodb";
import { ListSubmissionsQueryDto, SubmissionPayloadDto } from "../classes/validators/activitySubmissionValidators.js";
import { ID, SubmissionSource } from "../constants.js";


export interface IActivitySubmissionRepository {
    create(input: {
        courseId: ID;
        courseVersionId: ID;
        cohort: ID;
        activityId: ID;

        studentId: ID;
        studentEmail: string;
        studentName: string;

        payload: SubmissionPayloadDto;
        submissionSource: SubmissionSource;

        isLate: boolean;
    }, opts?: { session?: ClientSession }): Promise<string>;

    findById(id: string, opts?: { session?: ClientSession }): Promise<any | null>;

    list(query: ListSubmissionsQueryDto, opts?: { session?: ClientSession }): Promise<any[]>;

    updateStatusAndReview(id: string, update: {
        status: "APPROVED" | "REJECTED" | "REVERTED";
        review: {
            reviewedByTeacherId: string;
            reviewedAt: Date;
            decision: "APPROVE" | "REJECT" | "REVERT";
            note?: string;
        };
    }, opts?: { session?: ClientSession }): Promise<void>;
}