import { AbilityBuilder, MongoAbility } from "@casl/ability";
import { AuthenticatedUser, AuthenticatedUserEnrollements } from "#root/shared/interfaces/models.js";
import { CourseScope, createAbilityBuilder } from './types.js';

// Actions
export enum CourseActions {
    Create = "create",
    Modify = "modify",
    Delete = "delete",
    View = "view",
    Export = "export"
}

// Subjects
export type CourseSubjectType = CourseScope | 'Course';

// Actions
export type CourseActionsType = CourseActions | 'manage';

// Abilities
export type CourseAbility = [CourseActionsType, CourseSubjectType];

/**
 * Setup course abilities for a specific role
 */
export function setupCourseAbilities(
    builder: AbilityBuilder<any>,
    user: AuthenticatedUser
) {
    const { can, cannot } = builder;

    if (user.globalRole === 'admin') {
        can('manage', 'Course');
        return;
    }

    user.enrollments.forEach((enrollment: AuthenticatedUserEnrollements) => {
        const courseBounded = { courseId: enrollment.courseId };

        switch (enrollment.role) {
            case 'STUDENT':
                can(CourseActions.View, 'Course', courseBounded);
                break;
            case 'INSTRUCTOR':
                // Instructors hold the same permissions as an admin, narrowed
                // to their own courses — except creating and deleting courses,
                // and exporting one.
                can('manage', 'Course', courseBounded);
                cannot(CourseActions.Delete, 'Course', courseBounded);
                // Exporting lifts an entire course out of the platform, so it
                // stays with admins and managers. The deny is explicit because
                // the `manage` grant above would otherwise cover it.
                cannot(CourseActions.Export, 'Course', courseBounded);
                break;
            case 'MANAGER':
                can('manage', 'Course', courseBounded);
                cannot(CourseActions.Delete, 'Course', courseBounded);
                break;
            case 'TA':
                break;
        }
    });

    // Creating a course is admin-only. It has to be an unconditional deny
    // rather than the absence of a grant: a course being created has no id
    // yet, so controllers check the bare 'Course' subject type, and CASL
    // treats a type-only check as "could this ever be allowed?" — which the
    // conditional `can('manage', 'Course', {courseId})` above would satisfy.
    // Declared after the loop because the last matching rule wins.
    cannot(CourseActions.Create, 'Course');
}

/**
 * Get course abilities for a user - can be directly used by controllers
 */
export function getCourseAbility(user: AuthenticatedUser): MongoAbility<any> {
    const builder = createAbilityBuilder();
    setupCourseAbilities(builder, user);
    return builder.build();
}
