import { AbilityBuilder, MongoAbility } from "@casl/ability";
import { AuthenticatedUser, AuthenticatedUserEnrollements } from "#root/shared/interfaces/models.js";
import { CourseVersionScope, createAbilityBuilder } from './types.js';

// Actions
export enum CourseVersionActions {
    Create = "create",
    Delete = "delete",
    View = "view",
    Modify = "modify",
}

// Subjects
export type CourseVersionSubjectType = CourseVersionScope | 'CourseVersion';

// Actions
export type CourseVersionActionsType = CourseVersionActions | 'manage';

// Abilities
export type CourseVersionAbility = [CourseVersionActionsType, CourseVersionSubjectType];

/**
 * Setup course version abilities for a specific role
 */
export function setupCourseVersionAbilities(
    builder: AbilityBuilder<any>,
    user: AuthenticatedUser
) {
    const { can, cannot } = builder;
    
    if (user.globalRole === 'admin') {
        can('manage', 'CourseVersion');
        return;
    }

    user.enrollments.forEach((enrollment: AuthenticatedUserEnrollements) => {
        const versionBounded = { versionId: enrollment.versionId };

        switch (enrollment.role) {
            case 'STUDENT':
                can(CourseVersionActions.View, 'CourseVersion', versionBounded);
                break;
            case 'INSTRUCTOR':
                can(CourseVersionActions.View, 'CourseVersion', versionBounded);
                cannot(CourseVersionActions.Delete, 'CourseVersion', versionBounded);
                can(CourseVersionActions.Modify, 'CourseVersion', versionBounded);
                break;
            case 'MANAGER':
                can('manage', 'CourseVersion', versionBounded);
                break;
            case 'TA':
                can(CourseVersionActions.View, 'CourseVersion', versionBounded);
                break;
        }
    });
}

/**
 * Get course version abilities for a user - can be directly used by controllers
 */
export function getCourseVersionAbility(user: AuthenticatedUser): MongoAbility<any> {
    const builder = createAbilityBuilder();
    setupCourseVersionAbilities(builder, user);
    return builder.build();
}
