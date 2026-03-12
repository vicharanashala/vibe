import { ClientSession } from "mongodb";
import { FilterQueryDto, ListSubmissionsQueryDto, ReviewHpActivitySubmissionBodyDto, StudentActivitySubmissionsViewDto, SubmissionPayloadDto } from "../classes/validators/activitySubmissionValidators.js";
import { ID, SubmissionSource } from "../constants.js";
import { HpActivitySubmission } from "../models.js";
import { SubmissionFeedbackItem } from "../classes/transformers/ActivitySubmission.js";



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

    updateById(
        submissionId: string,
        input: Partial<HpActivitySubmission>,
        opts?: { session?: ClientSession }
    ): Promise<void>


    findById(id: string, opts?: { session?: ClientSession }): Promise<HpActivitySubmission | null>;

    list(query: ListSubmissionsQueryDto, opts?: { session?: ClientSession }): Promise<any[]>;

    updateStatusAndReview(
        id: string,
        update: Partial<HpActivitySubmission>,
        opts?: { session?: ClientSession }
    ): Promise<void>

    getByStudentId(
        studentId: string,
        query: FilterQueryDto,
        courseId?: string,
        courseVersionId?: string,
        cohortName?: string
    ): Promise<StudentActivitySubmissionsViewDto[]>

    getLatestByStudentId(studentId: string, activityId: string): Promise<HpActivitySubmission>

    getCountByStudentId(studentId: string, courseId: string, courseVersionId: string): Promise<number>

    getLateSubmissionCountByStudentId(studentId: string, courseId: string, courseVersionId: string): Promise<number>

    updateFeedbackById(id: string, feedback: SubmissionFeedbackItem, session?: ClientSession): Promise<boolean>
}