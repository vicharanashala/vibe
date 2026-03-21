import { ClientSession, ObjectId } from "mongodb";
import { CohortStudentItemDto, CohortStudentsListQueryDto, CourseWithVersionsDto } from "../classes/validators/courseAndCohorts.js";
import { ICohort, IEnrollment } from "#root/shared/index.js";
import { ID } from "../constants.js";

export interface ICohortRepository {
    /**
     * Returns total number of students enrolled in a specific course version.
     */
    getTotalStudentsCountForCourseVersion(
        courseVersionId: string
    ): Promise<number>;

    /**
     * Returns cohorts from the DB `cohorts` collection for a given course version.
     */
    getCohortsByVersionId(
        courseVersionId: string,
        isPublic?: boolean
    ): Promise<ICohort[]>;

    /**
     * Returns total number of students enrolled in a specific cohort within a course version.
     */
    getTotalStudentsCountForCohort(
        courseVersionId: string,
        cohortId: string
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
        cohortId: string
    ): Promise<CohortStudentItemDto[]>;

    /**
     * Returns students filtered by versionId and cohortId
     * (used for dynamic cohorts where enrollment has a cohortId field).
     */
    getStudentsForCohortByCohortId(
        courseVersionId: string,
        cohortId: string,
        query: CohortStudentsListQueryDto
    ): Promise<CohortStudentItemDto[]>;


    findEnrollment(
        userId: string | ObjectId,
        courseId: string,
        courseVersionId: string,
        cohort: string,
        session?: ClientSession,
    ): Promise<IEnrollment | null>

    setHPForEnrollment(
        userId: ID,
        courseId: ID,
        courseVersionId: ID,
        cohort: string,
        amount: number,
        session?: ClientSession,
    ): Promise<boolean>

    getDynamicCoursesWithVersions(
        session?: ClientSession
    ): Promise<CourseWithVersionsDto[]>

    getInstructorActiveEnrollments(
        userId: string
    ): Promise<{ courseId: string; courseVersionId: string; cohortId?: string }[]>

    getTotalHpDistributedByCohort(courseVersionId: string, cohortId: string): Promise<number>

    getCohortIdByCohortName(cohortName: string): Promise<string | null>

    updateCohortNameAcrossDB(
        courseVersionId: string,
        oldCohortName: string,
        newCohortName: string,
    ): Promise<void>

    getCurrentHpPointsByCohortId(
        studentId: string,
        courseId: string,
        courseVersionId: string,
        cohortId: string,
        session?: ClientSession
    ): Promise<number>
}