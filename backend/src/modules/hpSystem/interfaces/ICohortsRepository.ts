import { ClientSession, ObjectId } from "mongodb";
import { CohortStudentItemDto, CohortStudentsListQueryDto } from "../classes/validators/courseAndCohorts.js";
import { IEnrollment } from "#root/shared/index.js";
import { ID } from "../constants.js";

export interface ICohortRepository {
    /**
     * Returns total number of students enrolled in a specific course version.
     */
    getTotalStudentsCountForCourseVersion(
        courseVersionId: string
    ): Promise<number>;

    /**
     * Returns students for existing (legacy) cohorts
     * where cohort separation is handled by versionId mapping.
     */
    getStudentsForExistingCohortByVersionId(
        courseVersionId: string,
        query: CohortStudentsListQueryDto
    ): Promise<CohortStudentItemDto[]>;

    /**
     * Returns students filtered by versionId and cohortName
     * (used for new cohort system with tag separation).
     */
    getStudentsForCohortByVersionAndCohortName(
        courseVersionId: string,
        cohortName: string
    ): Promise<CohortStudentItemDto[]>;


    findEnrollment(
        userId: string | ObjectId,
        courseId: string,
        courseVersionId: string,
        session?: ClientSession,
    ): Promise<IEnrollment | null>

    setHPForEnrollment(
        userId: ID,
        courseId: ID,
        courseVersionId: ID,
        amount: number,
        session?: ClientSession,
    ): Promise<boolean>

    getCurrentHpPoints(
        userId: ID,
        courseId: ID,
        courseVersionId: ID,
        session?: ClientSession,
    ): Promise<number>
}