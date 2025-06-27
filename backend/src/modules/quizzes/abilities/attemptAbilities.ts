import { AbilityBuilder, MongoAbility } from "@casl/ability";
import { AuthenticatedUser, AuthenticatedUserEnrollements } from "#root/shared/interfaces/models.js";
import { AttemptScope, createAbilityBuilder } from './types.js';

// Actions
export enum AttemptActions {
    Start = "start",
    View = "view",
    Save = "save",
    Submit = "submit"
}

// Subjects
export type AttemptSubjectType = AttemptScope | 'Attempt';

// Actions
export type AttemptActionsType = AttemptActions | 'manage';

// Abilities
export type AttemptAbility = [AttemptActionsType, AttemptSubjectType];

/**
 * Setup attempt abilities for a specific role
 */
export function setupAttemptAbilities(
    builder: AbilityBuilder<any>,
    user: AuthenticatedUser
) {
    const { can, cannot } = builder;
    
    if (user.globalRole === 'admin') {
        can('manage', 'Attempt');
        return;
    }

    user.enrollments.forEach((enrollment: AuthenticatedUserEnrollements) => {
        const courseBounded = { courseId: enrollment.courseId };
        const courseVersionBounded = { courseId: enrollment.courseId, courseVersionId: enrollment.versionId };
        const userBounded = { userId: user.userId, courseId: enrollment.courseId, courseVersionId: enrollment.versionId };

        switch (enrollment.role) {
            case 'student':
                can(AttemptActions.Start, 'Attempt', userBounded);
                can(AttemptActions.Save, 'Attempt', userBounded);
                can(AttemptActions.Submit, 'Attempt', userBounded);
                break;
            case 'instructor':
                can(AttemptActions.View, 'Attempt', courseBounded);
                break;
            case 'manager':
                can('manage', 'Attempt', courseBounded);
                break;
            case 'ta':
                can(AttemptActions.View, 'Attempt', courseVersionBounded);
                break;
        }
    });
}

/**
 * Get attempt abilities for a user - can be directly used by controllers
 */
export function getAttemptAbility(user: AuthenticatedUser): MongoAbility<any> {
    const builder = createAbilityBuilder();
    setupAttemptAbilities(builder, user);
    return builder.build();
}
