import { CohortStudentItemDto, CohortStudentsListQueryDto } from "../classes/validators/courseAndCohorts.js";

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
}