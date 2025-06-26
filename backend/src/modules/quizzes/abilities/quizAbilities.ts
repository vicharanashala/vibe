import { AbilityBuilder, MongoAbility } from "@casl/ability";
import { AuthenticatedUser, AuthenticatedUserEnrollements } from "#root/shared/interfaces/models.js";
import { QuizScope, createAbilityBuilder } from './types.js';

// Actions
export enum QuizActions {
    ModifyBank = "modifyBank",
    View = "view",
    GetStats = "getStats",
    ModifySubmissions = "modifySubmissions",
}

// Subjects
export type QuizSubjectType = QuizScope | 'Quiz';

// Actions
export type QuizActionsType = QuizActions | 'manage';

// Abilities
export type QuizAbility = [QuizActionsType, QuizSubjectType];

/**
 * Setup quiz abilities for a specific role
 */
export function setupQuizAbilities(
    builder: AbilityBuilder<any>,
    user: AuthenticatedUser
) {
    const { can, cannot } = builder;
    
    if (user.globalRole === 'admin') {
        can('manage', 'Quiz');
        return;
    }

    user.enrollments.forEach((enrollment: AuthenticatedUserEnrollements) => {
        const courseBounded = { courseId: enrollment.courseId };
        const courseVersionBounded = { courseId: enrollment.courseId, versionId: enrollment.versionId };
        const userBounded = { userId: user.userId, courseId: enrollment.courseId, versionId: enrollment.versionId };

        switch (enrollment.role) {
            case 'student':
                break;
            case 'instructor':
                can(QuizActions.ModifyBank, 'Quiz', courseBounded);
                can(QuizActions.View, 'Quiz', courseBounded);
                can(QuizActions.GetStats, 'Quiz', courseBounded);
                can(QuizActions.ModifySubmissions, 'Quiz', courseBounded);
                break;
            case 'manager':
                can('manage', 'Quiz', courseBounded);
                break;
            case 'ta':
                can(QuizActions.ModifyBank, 'Quiz', courseVersionBounded);
                can(QuizActions.View, 'Quiz', courseVersionBounded);
                can(QuizActions.GetStats, 'Quiz', courseVersionBounded);
                break;
        }
    });
}

/**
 * Get quiz abilities for a user - can be directly used by controllers
 */
export function getQuizAbility(user: AuthenticatedUser): MongoAbility<any> {
    const builder = createAbilityBuilder();
    setupQuizAbilities(builder, user);
    return builder.build();
}
