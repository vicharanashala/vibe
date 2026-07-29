import { AbilityBuilder, MongoAbility } from "@casl/ability";
import { AuthenticatedUser, AuthenticatedUserEnrollements } from "#root/shared/interfaces/models.js";
import { CourseVersionScope, createAbilityBuilder } from './types.js';

// Actions
export enum CourseVersionActions {
    Create = "create",
    Delete = "delete",
    View = "view",
    Modify = "modify",
    Archive = "archive",
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
                // Same as an admin within their own versions, minus the
                // destructive lifecycle actions, which stay admin-only.
                can('manage', 'CourseVersion', versionBounded);
                cannot(CourseVersionActions.Delete, 'CourseVersion', versionBounded);
                cannot(CourseVersionActions.Archive, 'CourseVersion', versionBounded);
                break;
            case 'MANAGER':
                can('manage', 'CourseVersion', versionBounded);
                cannot(CourseVersionActions.Delete, 'CourseVersion', versionBounded);
                cannot(CourseVersionActions.Archive, 'CourseVersion', versionBounded);
                break;
            case 'TA':
                can(CourseVersionActions.View, 'CourseVersion', versionBounded);
                break;
        }
    });

    // Admin-only, unconditionally. Cloning a version (`POST .../copy`) checks
    // this action against the bare subject type and actually creates a whole
    // new Course, so without this deny any course manager could create
    // courses through the clone route. Declared after the loop because the
    // last matching rule wins.
    cannot(CourseVersionActions.Create, 'CourseVersion');
}

/**
 * Get course version abilities for a user - can be directly used by controllers
 */
export function getCourseVersionAbility(user: AuthenticatedUser): MongoAbility<any> {
    const builder = createAbilityBuilder();
    setupCourseVersionAbilities(builder, user);
    return builder.build();
}
