import { AbilityBuilder, MongoAbility } from '@casl/ability';
import { AuthenticatedUser, AuthenticatedUserEnrollements } from '#root/shared/interfaces/models.js';
import { createAnnouncementAbilityBuilder } from './types.js';

// Actions
export enum AnnouncementActions {
    Create = 'create',
    Update = 'update',
    Delete = 'delete',
    View = 'view',
}

// Subjects
export type AnnouncementSubjectType = 'Announcement';

// Actions type
export type AnnouncementActionsType = `${AnnouncementActions}` | 'manage';

// Abilities
export type AnnouncementAbilityType = [AnnouncementActionsType, AnnouncementSubjectType];

/**
 * Setup announcement abilities for a specific role
 * - ADMIN: manage all announcements
 * - INSTRUCTOR/MANAGER: create, update, delete, view announcements scoped to their courses
 * - STUDENT/TA/STAFF: view only
 */
export function setupAnnouncementAbilities(
    builder: AbilityBuilder<any>,
    user: AuthenticatedUser,
) {
    const { can } = builder;

    if (user.globalRole === 'admin') {
        can('manage', 'Announcement');
        return;
    }

    // All authenticated users can view announcements
    can(AnnouncementActions.View, 'Announcement');

    user.enrollments.forEach((enrollment: AuthenticatedUserEnrollements) => {
        const courseBounded = { courseId: enrollment.courseId };

        switch (enrollment.role) {
            case 'INSTRUCTOR':
                can(AnnouncementActions.Create, 'Announcement', courseBounded);
                can(AnnouncementActions.Update, 'Announcement', courseBounded);
                can(AnnouncementActions.Delete, 'Announcement', courseBounded);
                can(AnnouncementActions.View, 'Announcement', courseBounded);
                // Instructors can also create GENERAL announcements
                can(AnnouncementActions.Create, 'Announcement');
                break;
            case 'MANAGER':
                can('manage', 'Announcement', courseBounded);
                // Managers can also create GENERAL announcements
                can(AnnouncementActions.Create, 'Announcement');
                break;
            default:
                // STUDENT, TA, STAFF can only view
                break;
        }
    });
}

/**
 * Get announcement abilities for a user — can be directly used by controllers
 */
export function getAnnouncementAbility(user: AuthenticatedUser): MongoAbility<any> {
    const builder = createAnnouncementAbilityBuilder();
    setupAnnouncementAbilities(builder, user);
    return builder.build();
}
