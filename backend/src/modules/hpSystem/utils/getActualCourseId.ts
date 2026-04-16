import { ICohortRepository } from "../interfaces/ICohortsRepository.js";
import { COHORT_OVERRIDES } from "../constants.js";

/**
 * Resolves the actual courseId and courseVersionId for an activity.
 * This handles "legacy" courses that use pseudo-IDs (like 000...1) and 
 * maps them to their real database values via CohortRepository.resolveCohort.
 */
export const getActualCourseIds = async (
    activity: { 
        courseId: any; 
        courseVersionId: any; 
        cohort: string; 
        cohortId?: any 
    },
    cohortRepository: ICohortRepository
) => {
    // 1. Try resolving via cohortId or cohortName
    const resolvedCohort = await cohortRepository.resolveCohort(
        activity.cohortId || activity.cohort,
        activity.courseId?.toString(),
        activity.courseVersionId?.toString()
    );

    if (resolvedCohort) {
        return {
            courseId: resolvedCohort.courseId.toString(),
            courseVersionId: resolvedCohort.courseVersionId.toString(),
            resolvedCohortId: resolvedCohort._id!.toString()
        };
    }

    // 2. Fallback to legacy logic if resolution fails (though migration should have handled this)
    const legacyCourseIds = [
        "000000000000000000000001",
        "000000000000000000000002"
    ];

    const isLegacyCourse = legacyCourseIds.includes(activity.courseId?.toString());

    if (isLegacyCourse) {
        // Commented out: No longer relying on hardcoded overrides if we can avoid it.
        // But keeping the logic structure for reference during transition.
        const override = COHORT_OVERRIDES[activity.cohort];

        if (override) {
            return {
                courseId: override.courseId,
                courseVersionId: override.versionId,
            };
        }
    }

    return {
        courseId: activity.courseId?.toString(),
        courseVersionId: activity.courseVersionId?.toString(),
    };
};

