import { AbilityBuilder, MongoAbility } from '@casl/ability';
import { AuthenticatedUser, AuthenticatedUserEnrollements } from '#root/shared/interfaces/models.js';
import { AnomalyScope, createAbilityBuilder } from './types.js';

// Actions
export enum AnomalyActions {
  Create = 'create',
  View = 'view',
  Delete = 'delete',
}

// Subjects
export type AnomalySubjectType = AnomalyScope | 'Anomaly';
export type AnomalyActionsType = AnomalyActions | 'manage';
export type AnomalyAbility = [AnomalyActionsType, AnomalySubjectType];

/**
 * Setup anomaly abilities for a specific role
 */
export function setupAnomalyAbilities(
  builder: AbilityBuilder<any>,
  user: AuthenticatedUser
) {
  const { can, cannot } = builder;

  can(AnomalyActions.Create, 'Anomaly');
  
  if (user.globalRole === 'admin') {
    can('manage', 'Anomaly');
    return;
  }

  user.enrollments.forEach((enrollment: AuthenticatedUserEnrollements) => {
    const courseBounded = { courseId: enrollment.courseId };
    const versionBounded = { courseId: enrollment.courseId, versionId: enrollment.versionId };

    switch (enrollment.role) {
      case 'STUDENT':
        break;
      case 'INSTRUCTOR':
        can(AnomalyActions.View, 'Anomaly', versionBounded);
        can(AnomalyActions.Delete, 'Anomaly', versionBounded);
        break;
      case 'MANAGER':
        can('manage', 'Anomaly', courseBounded);
        break;
      case 'TA':
        can(AnomalyActions.View, 'Anomaly', versionBounded);
        break;
    }
  });
}

/**
 * Get anomaly abilities for a user - can be directly used by controllers
 */
export function getAnomalyAbility(user: AuthenticatedUser): MongoAbility<any> {
  const builder = createAbilityBuilder();
  setupAnomalyAbilities(builder, user);
  return builder.build();
}
