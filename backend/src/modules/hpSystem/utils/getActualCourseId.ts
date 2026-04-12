import { HpActivityTransformer } from "../classes/transformers/Activity.js";
import { COHORT_OVERRIDES, LEGACY_COURSE_KEYS } from "../constants.js";

export const getActualCourseIds = (activity: HpActivityTransformer) => {
    const key = `${activity.courseId}:${activity.courseVersionId}`;
    const legacyCourseIds = [
        "000000000000000000000001",
        "000000000000000000000002"
    ];

    const isLegacyCourse = legacyCourseIds.includes(activity.courseId.toString());

    if (isLegacyCourse) {
        const override = COHORT_OVERRIDES[activity.cohort];

        if (!override) {
            throw new Error(`No cohort override found for cohort: ${activity.cohort}`);
        }

        return {
            courseId: override.courseId,
            courseVersionId: override.versionId,
        };
    }

    return {
        courseId: activity.courseId,
        courseVersionId: activity.courseVersionId,
    };
};

