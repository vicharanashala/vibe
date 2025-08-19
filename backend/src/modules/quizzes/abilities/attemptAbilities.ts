import {AbilityBuilder, MongoAbility} from '@casl/ability';
import {
  AuthenticatedUser,
  AuthenticatedUserEnrollements,
} from '#root/shared/interfaces/models.js';
import {AttemptScope, createAbilityBuilder} from './types.js';
import {getFromContainer, InternalServerError} from 'routing-controllers';
import {ProgressService} from '#root/modules/users/services/ProgressService.js';
import {CourseSettingService} from '#root/modules/setting/index.js';

// Actions
export enum AttemptActions {
  Start = 'start',
  View = 'view',
  Save = 'save',
  Submit = 'submit',
}

// Subjects
export type AttemptSubjectType = AttemptScope | 'Attempt';

// Actions
export type AttemptActionsType = AttemptActions | 'manage';

// Abilities
export type AttemptAbility = [AttemptActionsType, AttemptSubjectType];

/**
 * Setup attempt abilities for a specific role
 */
export async function setupAttemptAbilities(
  builder: AbilityBuilder<any>,
  user: AuthenticatedUser,
) {
  const {can, cannot} = builder;

  if (user.globalRole === 'admin') {
    can('manage', 'Attempt');
    return;
  }

  const progressService = getFromContainer(ProgressService);
  const courseSettingService = getFromContainer(CourseSettingService);

  // Use Promise.all to handle async operations properly
  await Promise.all(
    user.enrollments.map(async (enrollment: AuthenticatedUserEnrollements) => {
      const courseBounded = {courseId: enrollment.courseId};
      const courseVersionBounded = {
        courseId: enrollment.courseId,
        versionId: enrollment.versionId,
      };

      switch (enrollment.role) {
        case 'STUDENT':
          const progress = await progressService.getUserProgress(
            user.userId,
            enrollment.courseId,
            enrollment.versionId,
          );
          const completedItems = await progressService.getCompletedItems(
            user.userId,
            enrollment.courseId,
            enrollment.versionId,
          );
          if (!progress) {
            throw new InternalServerError('No progress found for user');
          }
          // fetch courseVersion (to get linearProgression flag)
          const courseSettings = await courseSettingService.readCourseSettings(
            enrollment.courseId,
            enrollment.versionId,
          );

          const linearProgressionEnabled =
            courseSettings?.settings?.linearProgressionEnabled ?? true;

          const allowedItemIds = [...completedItems];
          allowedItemIds.push(progress.currentItem.toString());

          const attemptBounded: {quizId?: any} = {};
          
          if (linearProgressionEnabled) {
              // Grant permission for attempts on quizzes that correspond to allowed items
            attemptBounded.quizId = {$in: allowedItemIds};
          }
          can(AttemptActions.Start, 'Attempt', attemptBounded);
          can(AttemptActions.Save, 'Attempt', attemptBounded);
          can(AttemptActions.Submit, 'Attempt', attemptBounded);
          break;
        case 'INSTRUCTOR':
          can(AttemptActions.View, 'Attempt', courseBounded);
          break;
        case 'MANAGER':
          can('manage', 'Attempt', courseBounded);
          break;
        case 'TA':
          can(AttemptActions.View, 'Attempt', courseVersionBounded);
          break;
      }
    }),
  );
}

/**
 * Get attempt abilities for a user - can be directly used by controllers
 */
export async function getAttemptAbility(
  user: AuthenticatedUser,
): Promise<MongoAbility<any>> {
  const builder = createAbilityBuilder();
  await setupAttemptAbilities(builder, user);
  return builder.build();
}
