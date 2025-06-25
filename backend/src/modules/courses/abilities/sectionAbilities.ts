import { AbilityBuilder, MongoAbility } from "@casl/ability";
import { AuthenticatedUser, AuthenticatedUserEnrollements } from "#root/shared/interfaces/models.js";
import { CourseVersionScope, createAbilityBuilder } from './types.js';

// Actions
export enum SectionActions {
    Create = "create",
    Modify = "modify",
    Delete = "delete",
    Reorder = "reorder",
}

// Subjects
export type SectionSubjectType = CourseVersionScope | 'Section';

// Actions
export type SectionActionsType = SectionActions | 'manage';

// Abilities
export type SectionAbility = [SectionActionsType, SectionSubjectType];

/**
 * Setup section abilities for a specific role
 */
export function setupSectionAbilities(
    builder: AbilityBuilder<any>,
    user: AuthenticatedUser
) {
    const { can, cannot } = builder;
    
    if (user.globalRole === 'admin') {
        can('manage', 'Section');
        return;
    }

    user.enrollments.forEach((enrollment: AuthenticatedUserEnrollements) => {
        const courseBounded = { courseId: enrollment.courseId };

        switch (enrollment.role) {
            case 'student':
                break;
            case 'instructor':
                can(SectionActions.Create, 'Section', courseBounded);
                can(SectionActions.Modify, 'Section', courseBounded);
                can(SectionActions.Reorder, 'Section', courseBounded);
                can(SectionActions.Delete, 'Section', courseBounded);
                break;
            case 'manager':
                can('manage', 'Section', courseBounded);
                break;
            case 'ta':
                break;
        }
    });
}

/**
 * Get section abilities for a user - can be directly used by controllers
 */
export function getSectionAbility(user: AuthenticatedUser): MongoAbility<any> {
    const builder = createAbilityBuilder();
    setupSectionAbilities(builder, user);
    return builder.build();
}
