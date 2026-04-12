import {AbilityBuilder, createMongoAbility, MongoAbility} from '@casl/ability';
import {
  AuthenticatedUser,
  AuthenticatedUserEnrollements,
} from '#root/shared/interfaces/models.js';

// Actions
export enum CourseRegistrationActions {
  Create = 'create',
  Modify = 'modify',
  Delete = 'delete',
  View = 'view',
  Manage = 'manage',
}

export const courseRegistrationSubject = 'CourseRegistration';

/**
 * Setup course  registration abilities for a specific role
 */

export const setupCourseRegistrationAbilities = (
  builder: AbilityBuilder<any>,
  user: AuthenticatedUser,
) => {
  const {can, cannot} = builder;

  if (user.globalRole === 'admin') {
    can(CourseRegistrationActions.Manage, courseRegistrationSubject);
    return;
  }

  user.enrollments.forEach((enrollment: AuthenticatedUserEnrollements) => {
    const versionBounded = {versionId: enrollment.versionId};
    switch (enrollment.role) {
      case 'STUDENT':
        can(
          CourseRegistrationActions.Create,
          courseRegistrationSubject,
          versionBounded,
        );
        break;
      case 'INSTRUCTOR':
        can(
          CourseRegistrationActions.View,
          courseRegistrationSubject,
          versionBounded,
        );
        can(
          CourseRegistrationActions.Modify,
          courseRegistrationSubject,
          versionBounded,
        );
        break;
      case 'MANAGER':
        can(
          CourseRegistrationActions.Manage,
          courseRegistrationSubject,
          versionBounded,
        );
        break;
      case 'TA':
        break;
    }
  });
};
const createAbilityBuilder = () => {
  return new AbilityBuilder(createMongoAbility);
};

export const getCourseRegistrationAbility = (
  user: AuthenticatedUser,
): MongoAbility<any> => {
  const builder = createAbilityBuilder();
  setupCourseRegistrationAbilities(builder, user);
  return builder.build();
};
