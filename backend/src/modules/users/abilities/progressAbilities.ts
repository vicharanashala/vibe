import { AbilityBuilder, MongoAbility } from "@casl/ability";
import { AuthenticatedUser, AuthenticatedUserEnrollements } from "#root/shared/interfaces/models.js";
import { ProgressScope, createAbilityBuilder } from './types.js';

// Actions
export enum ProgressActions {
    Modify = "modify",
    View = "view"
}

// Subjects
export type ProgressSubjectType = ProgressScope | 'Progress';

// Actions
export type ProgressActionsType = `${ProgressActions}` | 'manage';

// Abilities
export type ProgressAbility = [ProgressActionsType, ProgressSubjectType];

/**
 * Setup progress abilities for a specific role
 */
export function setupProgressAbilities(
    builder: AbilityBuilder<any>,
    user: AuthenticatedUser
) {
    const { can, cannot } = builder;
    
    if (user.globalRole === 'admin') {
        can('manage', 'Progress');
        return;
    }

    user.enrollments.forEach((enrollment: AuthenticatedUserEnrollements) => {
        const courseBounded = { courseId: enrollment.courseId };
        const versionBounded = { courseId: enrollment.courseId, versionId: enrollment.versionId };
        const userBounded = { userId: user.userId, courseId: enrollment.courseId, versionId: enrollment.versionId };

        switch (enrollment.role) {
            case 'STUDENT':
                can(ProgressActions.View, 'Progress', userBounded);
                break;
            case 'INSTRUCTOR':
                can('manage', 'Progress', courseBounded);
                break;
            case 'MANAGER':
                can('manage', 'Progress', courseBounded);
                break;
            case 'TA':
                can(ProgressActions.View, 'Progress', versionBounded);
                break;
        }
    });
}

/**
 * Get progress abilities for a user - can be directly used by controllers
 */
export function getProgressAbility(user: AuthenticatedUser): MongoAbility<any> {
    const builder = createAbilityBuilder();
    setupProgressAbilities(builder, user);
    return builder.build();
}
