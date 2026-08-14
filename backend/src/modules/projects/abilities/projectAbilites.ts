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
  FeatureSubmission = 'feature_submission',
  ViewGallery = 'view_gallery',
  // ─── Rubric & Assessment ─────────────────────────────────────────────
  CreateRubric = 'create_rubric',
  ManageRubric = 'manage_rubric',
  ViewRubric = 'view_rubric',
  ViewRubricLibrary = 'view_rubric_library',
  Assess = 'assess',
  ViewAssessment = 'view_assessment',
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
        can(ProjectActions.ViewGallery, ProjectSubject, courseVersionBounded);
        // Students may only view their OWN assessment (userId-bounded).
        // They can NEVER assess themselves — Assess is not granted here.
        can(ProjectActions.ViewAssessment, ProjectSubject, userBounded);
        // Students need ViewRubric to resolve criterion names in their assessment feedback.
        // Read-only; they cannot create or manage rubrics (those actions remain instructor-only).
        can(ProjectActions.ViewRubric, ProjectSubject, courseVersionBounded);
        break;

      case 'INSTRUCTOR':
        can(ProjectActions.Create, ProjectSubject, userBounded);
        can(ProjectActions.Update, ProjectSubject, userBounded);
        can(ProjectActions.View, ProjectSubject, userBounded);
        can(ProjectActions.ViewGallery, ProjectSubject, courseVersionBounded);
        can(ProjectActions.FeatureSubmission, ProjectSubject, courseVersionBounded);
        // Rubric & Assessment abilities
        can(ProjectActions.CreateRubric, ProjectSubject, courseVersionBounded);
        can(ProjectActions.ManageRubric, ProjectSubject, courseVersionBounded);
        can(ProjectActions.ViewRubric, ProjectSubject, courseVersionBounded);
        can(ProjectActions.ViewRubricLibrary, ProjectSubject);
        can(ProjectActions.Assess, ProjectSubject, courseVersionBounded);
        can(ProjectActions.ViewAssessment, ProjectSubject, courseVersionBounded);
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
