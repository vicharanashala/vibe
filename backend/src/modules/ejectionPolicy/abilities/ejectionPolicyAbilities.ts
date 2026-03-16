import {AbilityBuilder, MongoAbility} from '@casl/ability';
import {
  AuthenticatedUser,
  AuthenticatedUserEnrollements,
} from '#root/shared/interfaces/models.js';
import {EjectionPolicyScope, createAbilityBuilder} from './types.js';

// Actions
export enum EjectionPolicyActions {
  Create = 'create',
  Modify = 'modify',
  Delete = 'delete',
  View = 'view',
}

// Subjects
export type EjectionPolicySubjectType = EjectionPolicyScope | 'EjectionPolicy';

// Actions
export type EjectionPolicyActionsType = `${EjectionPolicyActions}` | 'manage';

// Abilities
export type EjectionPolicyAbility = [
  EjectionPolicyActionsType,
  EjectionPolicySubjectType,
];

/**
 * Setup ejection policy abilities for a specific role
 *
 * Permission Model:
 * - ADMIN: Full control over all policies (platform-wide and course-specific)
 * - MANAGER: Can manage policies for their courses
 * - INSTRUCTOR: Can view policies for their courses
 * - TA: Can view policies for their course versions
 * - STUDENT: Can view policies affecting their course but cannot modify them
 */
export function setupEjectionPolicyAbilities(
  builder: AbilityBuilder<any>,
  user: AuthenticatedUser,
) {
  const {can, cannot} = builder;

  if (user.globalRole === 'admin') {
    can('manage', 'EjectionPolicy');
    return;
  }

  if (!user.enrollments || user.enrollments.length === 0) {
    return 'User has no enrollments';
  }

  user.enrollments.forEach((enrollment: AuthenticatedUserEnrollements) => {
    const courseBounded = {courseId: enrollment.courseId};
    const versionBounded = {
      courseId: enrollment.courseId,
      versionId: enrollment.versionId,
    };

    switch (enrollment.role) {
      case 'STUDENT':
        //  Can view policies affecting their course but cannot modify them
        can(EjectionPolicyActions.View, 'EjectionPolicy', courseBounded);
        can(EjectionPolicyActions.View, 'EjectionPolicy', {scope: 'platform'});
        break;

      case 'INSTRUCTOR':
        // Instructors can view policies for their courses
        can(EjectionPolicyActions.View, 'EjectionPolicy', courseBounded);
        // can('manage', 'EjectionPolicy', courseBounded);

        break;

      case 'MANAGER':
        // Managers have full control over policies for their courses
        can(EjectionPolicyActions.View, 'EjectionPolicy', courseBounded);
        can('manage', 'EjectionPolicy', courseBounded);
        break;

      case 'TA':
        // TAs can view policies for their course versions
        can(EjectionPolicyActions.View, 'EjectionPolicy', versionBounded);
        break;
    }
  });
}

/**
 * Get ejection policy abilities for a user - can be directly used by controllers
 */
export function getEjectionPolicyAbility(
  user: AuthenticatedUser,
): MongoAbility<any> {
  const builder = createAbilityBuilder();
  setupEjectionPolicyAbilities(builder, user);
  return builder.build();
}
