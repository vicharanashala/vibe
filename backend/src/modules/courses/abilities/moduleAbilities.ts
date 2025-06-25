import { AbilityBuilder, MongoAbility } from "@casl/ability";
import { AuthenticatedUser, AuthenticatedUserEnrollements } from "#root/shared/interfaces/models.js";
import { CourseVersionScope, createAbilityBuilder } from './types.js';

// Actions
export enum ModuleActions {
    Create = "create",
    Modify = "modify",
    Delete = "delete",
    Reorder = "reorder",
}

// Subjects
export type ModuleSubjectType = CourseVersionScope | 'Module';

// Actions
export type MooduleActionsType = ModuleActions | 'manage';

// Abilities
export type ModuleAbility = [MooduleActionsType, ModuleSubjectType];

/**
 * Setup module abilities for a specific role
 */
export function setupModuleAbilities(
    builder: AbilityBuilder<any>,
    user: AuthenticatedUser
) {
    const { can, cannot } = builder;
    
    if (user.globalRole === 'admin') {
        can('manage', 'Module');
        return;
    }

    user.enrollments.forEach((enrollment: AuthenticatedUserEnrollements) => {
        const courseBounded = { courseId: enrollment.courseId };

        switch (enrollment.role) {
            case 'student':
                break;
            case 'instructor':
                can(ModuleActions.Create, 'Module', courseBounded);
                can(ModuleActions.Modify, 'Module', courseBounded);
                can(ModuleActions.Reorder, 'Module', courseBounded);
                can(ModuleActions.Delete, 'Module', courseBounded);
                break;
            case 'manager':
                can('manage', 'Module', courseBounded);
                break;
            case 'ta':
                break;
        }
    });
}

/**
 * Get module abilities for a user - can be directly used by controllers
 */
export function getModuleAbility(user: AuthenticatedUser): MongoAbility<any> {
    const builder = createAbilityBuilder();
    setupModuleAbilities(builder, user);
    return builder.build();
}
