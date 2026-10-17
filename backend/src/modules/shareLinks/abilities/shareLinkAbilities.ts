import {AbilityBuilder, MongoAbility} from '@casl/ability';
import {
  AuthenticatedUser,
  AuthenticatedUserEnrollements,
} from '#root/shared/interfaces/models.js';
import {ShareLinkScope, createAbilityBuilder} from './types.js';

// Actions
export enum ShareLinkActions {
  Create = 'create',
  Modify = 'modify',
  View = 'view',
}

// Subjects
export type ShareLinkSubjectType = ShareLinkScope | 'ShareLink';

// Actions
export type ShareLinkActionsType = `${ShareLinkActions}` | 'manage';

// Abilities
export type ShareLinkAbility = [ShareLinkActionsType, ShareLinkSubjectType];

/**
 * Share links hand out course access and expose per-person watching, so they
 * stay with the roles that already own both: instructors and managers on the
 * course, TAs on their own version. Students never share.
 */
export function setupShareLinkAbilities(
  builder: AbilityBuilder<any>,
  user: AuthenticatedUser,
) {
  const {can} = builder;

  if (user.globalRole === 'admin') {
    can('manage', 'ShareLink');
    return;
  }

  user.enrollments.forEach((enrollment: AuthenticatedUserEnrollements) => {
    const courseBounded = {courseId: enrollment.courseId};
    const versionBounded = {
      courseId: enrollment.courseId,
      versionId: enrollment.versionId,
    };

    switch (enrollment.role) {
      case 'INSTRUCTOR':
        can(ShareLinkActions.Create, 'ShareLink', courseBounded);
        can(ShareLinkActions.Modify, 'ShareLink', courseBounded);
        can(ShareLinkActions.View, 'ShareLink', courseBounded);
        break;
      case 'MANAGER':
        can('manage', 'ShareLink', courseBounded);
        break;
      case 'TA':
        can(ShareLinkActions.Create, 'ShareLink', versionBounded);
        can(ShareLinkActions.View, 'ShareLink', versionBounded);
        break;
    }
  });
}

/**
 * Get share link abilities for a user - can be directly used by controllers
 */
export function getShareLinkAbility(user: AuthenticatedUser): MongoAbility<any> {
  const builder = createAbilityBuilder();
  setupShareLinkAbilities(builder, user);
  return builder.build();
}
