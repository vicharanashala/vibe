import { AbilityBuilder, MongoAbility } from "@casl/ability";
import { AuthenticatedUser, AuthenticatedUserEnrollements } from "#root/shared/interfaces/models.js";
import { QuestionBankScope, createAbilityBuilder } from './types.js';

// Actions
export enum QuestionBankActions {
    Create = "create",
    View = "view",
    Modify = "modify",
}

// Subjects
export type QuestionBankSubjectType = QuestionBankScope | 'QuestionBank';

// Actions
export type QuestionBankActionsType = QuestionBankActions | 'manage';

// Abilities
export type QuestionBankAbility = [QuestionBankActionsType, QuestionBankSubjectType];

/**
 * Setup question bank abilities for a specific role
 */
export function setupQuestionBankAbilities(
    builder: AbilityBuilder<any>,
    user: AuthenticatedUser
) {
    const { can, cannot } = builder;
    
    if (user.globalRole === 'admin') {
        can('manage', 'QuestionBank');
        return;
    }

    user.enrollments.forEach((enrollment: AuthenticatedUserEnrollements) => {
        const courseBounded = { courseId: enrollment.courseId };
        const courseVersionBounded = { courseId: enrollment.courseId, courseVersionId: enrollment.versionId };

        switch (enrollment.role) {
            case 'STUDENT':
                // Students typically don't have access to question banks
                break;
            case 'INSTRUCTOR':
                can(QuestionBankActions.Create, 'QuestionBank', courseBounded);
                can(QuestionBankActions.Modify, 'QuestionBank', courseBounded);
                can(QuestionBankActions.View, 'QuestionBank', courseBounded);
                break;
            case 'MANAGER':
                can('manage', 'QuestionBank', courseBounded);
                break;
            case 'TA':
                can(QuestionBankActions.View, 'QuestionBank', courseVersionBounded);
                break;
        }
    });
}

/**
 * Get question bank abilities for a user - can be directly used by controllers
 */
export function getQuestionBankAbility(user: AuthenticatedUser): MongoAbility<any> {
    const builder = createAbilityBuilder();
    setupQuestionBankAbilities(builder, user);
    return builder.build();
}
