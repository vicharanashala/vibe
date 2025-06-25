import { AbilityBuilder, MongoAbility } from "@casl/ability";
import { AuthenticatedUser, AuthenticatedUserEnrollements } from "#root/shared/interfaces/models.js";
import { EnrollmentScope, createAbilityBuilder } from './types.js';

// Actions
export enum EnrollmentActions {
    Create = "create",
    Modify = "modify",
    Delete = "delete",
    View = "view"
}

// Subjects
export type EnrollmentSubjectType = EnrollmentScope | 'Enrollment';

// Actions
export type EnrollmentActionsType = `${EnrollmentActions}` | 'manage';

// Abilities
export type EnrollmentAbility = [EnrollmentActionsType, EnrollmentSubjectType];

/**
 * Setup enrollment abilities for a specific role
 */
export function setupEnrollmentAbilities(
    builder: AbilityBuilder<any>,
    user: AuthenticatedUser
) {
    const { can, cannot } = builder;
    
    if (user.globalRole === 'admin') {
        can('manage', 'Enrollment');
        return;
    }

    user.enrollments.forEach((enrollment: AuthenticatedUserEnrollements) => {
        const courseBounded = { courseId: enrollment.courseId };
        const versionBounded = { courseId: enrollment.courseId, versionId: enrollment.versionId };
        const userBounded = { userId: user.userId, courseId: enrollment.courseId, versionId: enrollment.versionId };

        switch (enrollment.role) {
            case 'student':
                can(EnrollmentActions.View, 'Enrollment', userBounded);
                break;
            case 'instructor':
                can(EnrollmentActions.View, 'Enrollment', courseBounded);
                cannot(EnrollmentActions.Delete, 'Enrollment', courseBounded);
                cannot(EnrollmentActions.Modify, 'Enrollment', courseBounded);
                break;
            case 'manager':
                can('manage', 'Enrollment', courseBounded);
                break;
            case 'ta':
                can(EnrollmentActions.View, 'Enrollment', versionBounded);
                break;
        }
    });
}

/**
 * Get enrollment abilities for a user - can be directly used by controllers
 */
export function getEnrollmentAbility(user: AuthenticatedUser): MongoAbility<any> {
    const builder = createAbilityBuilder();
    setupEnrollmentAbilities(builder, user);
    return builder.build();
}
