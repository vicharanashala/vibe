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

    getCountByStudentId(studentId: string, courseId: string, courseVersionId: string, cohortName: string): Promise<number>

    getLateSubmissionCountByStudentId(studentId: string, courseId: string, courseVersionId: string, cohortName: string): Promise<number>

    getLateSubmissionCount(cohortName: string, courseVersionId: string, session?: ClientSession): Promise<number>

    updateFeedbackById(id: string, feedback: SubmissionFeedbackItem, session?: ClientSession): Promise<boolean>

    getCompletedActivitiesCountByStudentId(studentId: string): Promise<Array<{ cohort: string, count: number }>>

    getCohortActivityStats(cohortName: string, activityId: string, session?: ClientSession): Promise<{
        totalSubmissions: number;
        approvedCount: number;
        rejectedCount: number;
        revertedCount: number;
    }>

    getDailyActivityCount(
        cohortName: string,
        courseVersionId: string,
        startDate: Date,
        endDate: Date,
        session?: ClientSession
    ): Promise<number>;

    getDailyActivityCountByStatus(
        cohortName: string,
        courseVersionId: string,
        startDate: Date,
        endDate: Date,
        status: string,
        session?: ClientSession
    ): Promise<number>;


    getStudentProgressForCohort(
        cohortName: string,
        courseVersionId: string,
        session?: ClientSession
    ): Promise<{
        completed: number;
        inProgress: number;
        notStarted: number;
    }>;

    getPendingSubmissionsCount(
        cohortName: string,
        courseVersionId: string,
        session?: ClientSession
    ): Promise<number>;

    listSubmissionsBeforeDeadline(activityId: string): Promise<HpActivitySubmission[]>
}