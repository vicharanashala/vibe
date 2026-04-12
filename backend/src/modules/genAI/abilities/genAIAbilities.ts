import { AbilityBuilder, createMongoAbility, MongoAbility } from "@casl/ability";
import { AuthenticatedUser } from "#root/shared/interfaces/models.js";
import { GenAIScope, createAbilityBuilder } from "./types.js";

// Use enum for actions
export enum GenAIActions {
  Create = 'create',
  Modify = 'modify',
}
export type GenAIActionsType = GenAIActions | 'manage';
export type GenAISubjectType = GenAIScope | 'GenAI';
export type GenAIAbility = [GenAIActionsType, GenAISubjectType];

/**
 * Setup GenAI abilities for a specific role
 */
export function setupGenAIAbilities(
  builder: AbilityBuilder<any>,
  user: AuthenticatedUser
) {
  const { can } = builder;

  if (user.globalRole === 'admin') {
    can('manage', 'GenAI');
    return;
  }

  // Allow manage for MANAGER, INSTRUCTOR, TA roles in enrollments
  if (user.enrollments && Array.isArray(user.enrollments)) {
    for (const enrollment of user.enrollments) {
        const courseBounded = { courseId: enrollment.courseId };
        const versionBounded = { courseId: enrollment.courseId, versionId: enrollment.versionId };

        switch (enrollment.role) {
            case 'MANAGER':
                can('manage', 'GenAI', courseBounded);
                break;
            case 'INSTRUCTOR':
                can(GenAIActions.Create, 'GenAI', courseBounded);
                can(GenAIActions.Modify, 'GenAI', courseBounded);
                break;
            case 'TA':
                can(GenAIActions.Create, 'GenAI', versionBounded);
                can(GenAIActions.Modify, 'GenAI', versionBounded);
                break;
            case 'STUDENT':
                break;
      }
    }
  }
}

/**
 * Get GenAI abilities for a user - can be directly used by controllers
 */
export function getGenAIAbility(user: AuthenticatedUser): MongoAbility<any> {
  const builder = createAbilityBuilder();
  setupGenAIAbilities(builder, user);
  return builder.build();
}