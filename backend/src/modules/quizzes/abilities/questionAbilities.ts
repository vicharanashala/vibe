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
            case 'STUDENT':
                // Students typically don't have access to managing questions
                break;
            case 'INSTRUCTOR':
                can(QuestionActions.Create, 'Question');
                can(QuestionActions.Modify, 'Question');
                can(QuestionActions.View, 'Question');
                can(QuestionActions.Delete, 'Question');
                break;
            case 'MANAGER':
                can('manage', 'Question', courseBounded);
                break;
            case 'TA':
                can(QuestionActions.View, 'Question', courseVersionBounded);
                break;
        }
    });

    /*Previous abilities kept commented incase they are required again*/
    // // anyone can create a question
    // can(QuestionActions.Create, 'Question');
    // // anyone can view a question
    // can(QuestionActions.View, 'Question');
    // // can only modify their own questions
    // can(QuestionActions.Modify, 'Question', { createdBy: user.userId });
    // // can only delete their own questions
    // can(QuestionActions.Delete, 'Question', { createdBy: user.userId });
}

/**
 * Get question abilities for a user - can be directly used by controllers
 */
export function getQuestionAbility(user: AuthenticatedUser): MongoAbility<any> {
    const builder = createAbilityBuilder();
    setupQuestionAbilities(builder, user);
    return builder.build();
}
