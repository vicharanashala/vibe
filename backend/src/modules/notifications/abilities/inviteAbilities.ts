import { AbilityBuilder, MongoAbility } from "@casl/ability";
import { AuthenticatedUser, AuthenticatedUserEnrollements } from "#root/shared/interfaces/models.js";
import { InviteScope, createAbilityBuilder } from './types.js';

// Actions
export enum InviteActions {
    Create = "create",
    Modify = "modify",
    Process = "process",
    View = "view",
}

// Subjects
export type InviteSubjectType = InviteScope | 'Invite';

// Actions
export type InviteActionsType = `${InviteActions}` | 'manage';

// Abilities
export type InviteAbility = [InviteActionsType, InviteSubjectType];

/**
 * Setup notification abilities for a specific role
 * Role-based invitation permissions:
 * - STUDENT: Can only invite other students to their course version
 * - TA: Can invite students and other TAs to their course version
 * - INSTRUCTOR: Can invite anyone to their course (all versions)
 * - MANAGER: Can invite anyone to their course (all versions)
 */
export function setupInviteAbilities(
    builder: AbilityBuilder<any>,
    user: AuthenticatedUser
) {
    const { can, cannot } = builder;
    
    if (user.globalRole === 'admin') {
        can('manage', 'Invite');
        return;
    }
    
    // Users can always view and manage their own notifications
    can(InviteActions.Process, 'Invite');
    
    user.enrollments.forEach((enrollment: AuthenticatedUserEnrollements) => {
        const courseBounded = { courseId: enrollment.courseId };
        const versionBounded = { courseId: enrollment.courseId, versionId: enrollment.versionId };
        
        switch (enrollment.role) {
            case 'STUDENT':
                // Students can only invite other students to their course version
                can(InviteActions.Create, 'Invite', { ...versionBounded, targetRole: 'STUDENT' });
                break;
            case 'INSTRUCTOR':
                can(InviteActions.Create, 'Invite', courseBounded);
                can(InviteActions.Modify, 'Invite', courseBounded);
                can(InviteActions.View, 'Invite', courseBounded);
                break;
            case 'MANAGER':
                can('manage', 'Invite', courseBounded);
                break;
            case 'TA':
                // TAs can invite students and other TAs to their course version
                can(InviteActions.Create, 'Invite', { ...versionBounded, targetRole: 'STUDENT' });
                can(InviteActions.Create, 'Invite', { ...versionBounded, targetRole: 'TA' });
                can(InviteActions.View, 'Invite', versionBounded);
                break;
        }
    });
}

/**
 * Get notification abilities for a user - can be directly used by controllers
 */
export function getInviteAbility(user: AuthenticatedUser): MongoAbility<any> {
    const builder = createAbilityBuilder();
    setupInviteAbilities(builder, user);
    return builder.build();
}
