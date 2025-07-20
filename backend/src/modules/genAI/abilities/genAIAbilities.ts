import { AbilityBuilder, createMongoAbility, MongoAbility } from "@casl/ability";
import { AuthenticatedUser, AuthenticatedUserEnrollements } from "#root/shared/interfaces/models.js";

// Actions
export enum GenAIActions {
    Create = "create",
    Modify = "modify",
    Delete = "delete",
    View = "view"
}

// Subjects
export type GenAISubjectType = 'GenAI';

// Actions
export type GenAIActionsType = GenAIActions | 'manage';

// Abilities
export type GenAIAbility = [GenAIActionsType, GenAISubjectType];

/**
 * Setup genAI abilities for a specific role
 */
export function setupGenAIAbilities(
    builder: AbilityBuilder<any>,
    user: AuthenticatedUser
) {
    const { can, cannot } = builder;

    if (user.globalRole === 'admin') {
        can('manage', 'GenAI');
        return;
    }

    user.enrollments.forEach((enrollment: AuthenticatedUserEnrollements) => {
        const courseBounded = { courseId: enrollment.courseId };

        switch (enrollment.role) {
            case 'STUDENT':
                break;
            case 'INSTRUCTOR':
                can(GenAIActions.View, 'GenAI', courseBounded);
                cannot(GenAIActions.Delete, 'GenAI', courseBounded);
                break;
            case 'MANAGER':
                can('manage', 'GenAI', courseBounded);
                cannot(GenAIActions.Delete, 'GenAI', courseBounded);
                break;
            case 'TA':
                break;
        }
    });
}

export function getGenAIAbility(user: AuthenticatedUser): MongoAbility<any> {
    const builder = new AbilityBuilder(createMongoAbility);
    setupGenAIAbilities(builder, user);
    return builder.build();
}