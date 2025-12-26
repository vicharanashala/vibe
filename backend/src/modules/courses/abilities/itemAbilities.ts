import {AbilityBuilder, MongoAbility} from '@casl/ability';
import {
  AuthenticatedUser,
  AuthenticatedUserEnrollements,
} from '#root/shared/interfaces/models.js';
import {ItemScope, createAbilityBuilder} from './types.js';
import {
  getFromContainer,
  InternalServerError,
  NotFoundError,
} from 'routing-controllers';
import {ProgressService} from '#root/modules/users/services/ProgressService.js';
import {CourseSettingService} from '#root/modules/setting/services/CourseSettingService.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {MongoDatabase} from '#root/shared/database/providers/mongo/MongoDatabase.js';
import {ObjectId} from 'mongodb';
import {UserQuizMetricsRepository} from '#root/modules/quizzes/repositories/index.js';
import {CourseRepository} from '#root/shared/index.js';
import {QuizService} from '#root/modules/quizzes/services/QuizService.js';

// Actions
export enum ItemActions {
  Create = 'create',
  ViewAll = 'viewAll',
  Modify = 'modify',
  View = 'view',
  Delete = 'delete',
}

// Subjects
export type ItemSubjectType = ItemScope | 'Item';

// Actions
export type ItemActionsType = ItemActions | 'manage';

// Abilities
export type ItemAbility = [ItemActionsType, ItemSubjectType];

/**
 * Setup item abilities for a specific role
 */
export async function setupItemAbilities(
  builder: AbilityBuilder<any>,
  user: AuthenticatedUser,
) {
  const {can, cannot} = builder;

  if (user.globalRole === 'admin') {
    can('manage', 'Item');
    return;
  }

  const progressService = getFromContainer(ProgressService);
  const courseSettingService = getFromContainer(CourseSettingService);

  // Use Promise.all to handle async operations properly
  await Promise.all(
    user.enrollments.map(async (enrollment: AuthenticatedUserEnrollements) => {
      const versionBounded = {versionId: enrollment.versionId};

      switch (enrollment.role) {
        case 'STUDENT':
          can(ItemActions.ViewAll, 'Item', versionBounded);

          // fetch courseVersion (to get linearProgression flag)
          const courseSettings = await courseSettingService.readCourseSettings(
            enrollment.courseId,
            enrollment.versionId,
          );

          const linearProgressionEnabled =
            courseSettings?.settings?.linearProgressionEnabled ?? true;

          let progress;
          try {
            progress = await progressService.getUserProgress(
              user.userId,
              enrollment.courseId,
              enrollment.versionId,
            );
          } catch (error) {
            console.log(
              'No progress found for student, course not started yet',
            );
            progress = null;
          }

          // return all the itemId having watchtime doc
          const completedItems = await progressService.getCompletedItems(
            user.userId,
            enrollment.courseId,
            enrollment.versionId,
          );

          // Convert all completed items to strings for consistency
          const completedItemsStr = completedItems.map(id => id.toString());

          const itemBounded: {
            courseId: string;
            versionId: string;
            itemId?: any;
          } = {
            courseId: enrollment.courseId,
            versionId: enrollment.versionId,
          };

          if (!progress.currentItem) {
            // User has not started the course yet
            // Allow only ViewAll (or nothing, based on your rules)
            try {
              const firstItem = await progressService.getFirstItem(
                enrollment.versionId,
              );
              // const firstItem = await this.itemService.getFirstItem(enrollment.versionId);
              can(ItemActions.View, 'Item', {
                courseId: enrollment.courseId,
                versionId: enrollment.versionId,
                ItemId: firstItem?.itemId,
              });
            } catch (error) {
            }
            return;
          }

          if (!progress) {
            const itemBounded = {
              courseId: enrollment.courseId,
              versionId: enrollment.versionId,
            };
            can(ItemActions.View, 'Item', itemBounded);
            break;
          }

          const allowedItemIds = [...completedItemsStr];
          const currentItemId = progress.currentItem.toString();

          // Always add current item to allowed list
          if (!allowedItemIds.includes(currentItemId)) {
            allowedItemIds.push(currentItemId);
          }

          // check if the user remaining attempts of a quiz is over
          const quizMetrics = await progressService.getUserMetricsForQuiz(
            user.userId,
            currentItemId,
          );

          if (quizMetrics && quizMetrics.remainingAttempts == 0) {
            const {nextItemId} = await progressService.determineNextAllowedItem(
              currentItemId,
              quizMetrics,
              enrollment,
            );

            if (nextItemId) {
              const nextItemIdStr = nextItemId.toString();
              if (!allowedItemIds.includes(nextItemIdStr)) {
                allowedItemIds.push(nextItemIdStr);
              }
            }
          }

          console.log('Allowed item IDs for user:', {
            userId: user.userId,
            currentItemId,
            allowedItemIds,
            completedCount: completedItemsStr.length,
          });

          if (linearProgressionEnabled) {
            itemBounded.itemId = {$in: allowedItemIds};
          } else {
          }

          can(ItemActions.View, 'Item', itemBounded);
          break;
        case 'INSTRUCTOR':
          can(ItemActions.Create, 'Item', versionBounded);
          can(ItemActions.Modify, 'Item', versionBounded);
          can(ItemActions.Delete, 'Item', versionBounded);
          can(ItemActions.View, 'Item', versionBounded);
          can(ItemActions.ViewAll, 'Item', versionBounded);
          break;
        case 'MANAGER':
          can('manage', 'Item', versionBounded);
          break;
        case 'TA':
          can(ItemActions.ViewAll, 'Item', versionBounded);
          break;
      }
    }),
  );
}

/**
 * Get item abilities for a user - can be directly used by controllers
 */
export async function getItemAbility(
  user: AuthenticatedUser,
): Promise<MongoAbility<any>> {
  const builder = createAbilityBuilder();
  await setupItemAbilities(builder, user);
  return builder.build();
}
