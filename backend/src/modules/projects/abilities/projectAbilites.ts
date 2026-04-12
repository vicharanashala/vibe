import {createAbilityBuilder} from '#root/modules/notifications/abilities/types.js';
import {
  AuthenticatedUser,
  AuthenticatedUserEnrollements,
} from '#root/shared/index.js';
import {AbilityBuilder, MongoAbility} from '@casl/ability';

export enum ProjectActions {
  View = 'view',
  Create = 'create',
  Update = 'update',
  Submit = 'submit',
  Manage = 'manage',
}

export const ProjectSubject = 'Project';

export const setupProjectAbilities = (
  builder: AbilityBuilder<any>,
  user: AuthenticatedUser,
): void => {
  const {can} = builder;

  if (user.globalRole === 'admin') {
    can(ProjectActions.Manage, ProjectSubject);
  }

  user.enrollments.forEach((enrollment: AuthenticatedUserEnrollements) => {
    const courseVersionBounded = {
      courseId: enrollment.courseId,
      versionId: enrollment.versionId,
    };
    const userBounded = {
      userId: user.userId,
      courseId: enrollment.courseId,
      versionId: enrollment.versionId,
    };

    switch (enrollment.role) {
      case 'STUDENT':
        can(ProjectActions.Submit, ProjectSubject, userBounded);
        break;

      case 'INSTRUCTOR':
        can(ProjectActions.Create, ProjectSubject, userBounded);
        can(ProjectActions.Update, ProjectSubject, userBounded);
        can(ProjectActions.View, ProjectSubject, userBounded);
        break;

      case 'MANAGER':
        can('manage', 'Quiz', courseVersionBounded);
        break;

      case 'TA':
        break;
    }
  });
};

export const projectAbility = async (
  user: AuthenticatedUser,
): Promise<MongoAbility<any>> => {
  const builder = createAbilityBuilder();
  setupProjectAbilities(builder, user);
  return builder.build();
};
