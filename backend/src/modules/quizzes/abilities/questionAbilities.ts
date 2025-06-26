import { AbilityBuilder, MongoAbility } from "@casl/ability";
import { AuthenticatedUser, AuthenticatedUserEnrollements } from "#root/shared/interfaces/models.js";
import { QuestionScope, createAbilityBuilder } from './types.js';

// Actions
export enum QuestionActions {
    Create = "create",
    Modify = "modify",
    Delete = "delete",
    View = "view",
}

// Subjects
export type QuestionSubjectType = QuestionScope | 'Question';

// Actions
export type QuestionActionsType = QuestionActions | 'manage';

// Abilities
export type QuestionAbility = [QuestionActionsType, QuestionSubjectType];

/**
 * Setup question abilities for a specific role
 */
export function setupQuestionAbilities(
    builder: AbilityBuilder<any>,
    user: AuthenticatedUser
) {
    const { can, cannot } = builder;
    
    if (user.globalRole === 'admin') {
        can('manage', 'Question');
        return;
    }

    user.enrollments.forEach((enrollment: AuthenticatedUserEnrollements) => {
        const courseBounded = { courseId: enrollment.courseId };
        const courseVersionBounded = { courseId: enrollment.courseId, versionId: enrollment.versionId };

        switch (enrollment.role) {
            case 'student':
                break;
            case 'instructor':
                can(QuestionActions.Create, 'Question', courseBounded);
                can(QuestionActions.Modify, 'Question', courseBounded);
                can(QuestionActions.Delete, 'Question', courseBounded);
                can(QuestionActions.View, 'Question', courseBounded);
                break;
            case 'manager':
                can('manage', 'Question', courseBounded);
                break;
            case 'ta':
                can(QuestionActions.Create, 'Question', courseVersionBounded);
                can(QuestionActions.Modify, 'Question', courseVersionBounded);
                can(QuestionActions.View, 'Question', courseVersionBounded);
                break;
        }
    });
}

/**
 * Get question abilities for a user - can be directly used by controllers
 */
export function getQuestionAbility(user: AuthenticatedUser): MongoAbility<any> {
    const builder = createAbilityBuilder();
    setupQuestionAbilities(builder, user);
    return builder.build();
}
