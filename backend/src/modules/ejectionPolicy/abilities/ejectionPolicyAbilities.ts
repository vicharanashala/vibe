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
  const {can} = builder;

  if (user.globalRole === 'admin') {
    can('manage', 'EjectionPolicy');
    return;
  }

  // 🔥 DO NOT block if no enrollments

  user.enrollments?.forEach(enrollment => {
    const courseBounded = {courseId: enrollment.courseId};

    switch (enrollment.role) {
      case 'STUDENT':
        can('view', 'EjectionPolicy', courseBounded);
        can('view', 'EjectionPolicy', {scope: 'platform'});
        break;

      case 'INSTRUCTOR':
        can('view', 'EjectionPolicy', courseBounded);
        break;

      case 'MANAGER':
        can('manage', 'EjectionPolicy', courseBounded);
        break;

      case 'TA':
        can('view', 'EjectionPolicy', {
          courseId: enrollment.courseId,
          versionId: enrollment.versionId,
        });
        break;
    }
  });

  // 🔥 Fallback for invite flow
  can('view', 'EjectionPolicy');
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
