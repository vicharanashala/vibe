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
}

export const courseRegistrationSubject =  'CourseRegistration';

const createAbilityBuilder = () => {
  return new AbilityBuilder(createMongoAbility);
}
/**
 * Setup course  registration abilities for a specific role
 */
export function setupCourseRegistrationAbilities(
  builder: AbilityBuilder<any>,
  user: AuthenticatedUser,
) {
  const {can, cannot} = builder;

  if (user.globalRole === 'admin') {
    can('manage', 'Course');
    return;
  }

  user.enrollments.forEach((enrollment: AuthenticatedUserEnrollements) => {
    const versionBounded = {courseVersionId: enrollment.versionId};
    switch (enrollment.role) {
      case 'STUDENT':
        can(CourseRegistrationActions.Create, courseRegistrationSubject, versionBounded);
        break;
      case 'INSTRUCTOR':
        can(CourseRegistrationActions.View, courseRegistrationSubject, versionBounded);
        can(CourseRegistrationActions.Modify, courseRegistrationSubject, versionBounded);
        break;
      case 'MANAGER':
        can('manage', courseRegistrationSubject, versionBounded);
        break;
      case 'TA':
        break;
    }
  });
}


export function getCourseRegistrationAbility(user: AuthenticatedUser): MongoAbility<any> {
  const builder = createAbilityBuilder();
  setupCourseRegistrationAbilities(builder, user);
  return builder.build();
}
