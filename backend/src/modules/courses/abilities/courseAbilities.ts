import { AbilityBuilder, MongoAbility } from "@casl/ability";
import { AuthenticatedUser, AuthenticatedUserEnrollements } from "#root/shared/interfaces/models.js";
import { CourseScope, createAbilityBuilder } from './types.js';

// Actions
export enum CourseActions {
    Create = "create",
    Modify = "modify",
    Delete = "delete",
    View = "view"
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
                break;
            case 'INSTRUCTOR':
                can(CourseActions.View, 'Course', courseBounded);
                cannot(CourseActions.Delete, 'Course', courseBounded);
                break;
            case 'MANAGER':
                can('manage', 'Course', courseBounded);
                cannot(CourseActions.Delete, 'Course', courseBounded);
                break;
            case 'TA':
                break;
        }
    });
}

/**
 * Get course abilities for a user - can be directly used by controllers
 */
export function getCourseAbility(user: AuthenticatedUser): MongoAbility<any> {
    const builder = createAbilityBuilder();
    setupCourseAbilities(builder, user);
    return builder.build();
}
