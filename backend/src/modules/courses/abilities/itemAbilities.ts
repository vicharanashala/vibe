import { AbilityBuilder, MongoAbility } from "@casl/ability";
import { AuthenticatedUser, AuthenticatedUserEnrollements } from "#root/shared/interfaces/models.js";
import { ItemScope, createAbilityBuilder } from './types.js';
import { getFromContainer, InternalServerError } from "routing-controllers";
import { ProgressService } from "#root/modules/users/services/ProgressService.js";
import { CourseSettingService } from "#root/modules/setting/services/CourseSettingService.js";

// Actions
export enum ItemActions {
    Create = "create",
    ViewAll = "viewAll",
    Modify = "modify",
    View = "view",
    Delete = "delete"
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
    user: AuthenticatedUser
) {
    const { can, cannot } = builder;
    
    if (user.globalRole === 'admin') {
        can('manage', 'Item');
        return;
    }
    const progressService = getFromContainer(ProgressService);
    const courseSettingService = getFromContainer(CourseSettingService);
     
    // Use Promise.all to handle async operations properly
    await Promise.all(user.enrollments.map(async (enrollment: AuthenticatedUserEnrollements) => {
        const versionBounded = { versionId: enrollment.versionId };
        
        switch (enrollment.role) {
            case 'STUDENT':
                can(ItemActions.ViewAll, 'Item', versionBounded);

                // fetch courseVersion (to get linearProgression flag)
                const courseSettings = await courseSettingService.readCourseSettings(
                enrollment.courseId,
                enrollment.versionId
                );

                
                const linearProgressionEnabled = courseSettings?.settings?.linearProgressionEnabled ?? true;

                const progress = await progressService.getUserProgress(user.userId, enrollment.courseId, enrollment.versionId);

                // return all the itemId having watchtime doc
                const completedItems = await progressService.getCompletedItems(user.userId, enrollment.courseId, enrollment.versionId);
                
                if (!progress) {
                    throw new InternalServerError('No progress found for user');
                }

                const allowedItemIds = [...completedItems];
                allowedItemIds.push(progress.currentItem.toString());

                const itemBounded: { courseId: string, versionId: string, itemId?: any } = {
                    courseId: enrollment.courseId,
                    versionId: enrollment.versionId,
                };
                
                // Grant permission to view items that are in the allowed list
                if (linearProgressionEnabled) {
                    itemBounded.itemId = { $in: allowedItemIds };
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
    }));
}

/**
 * Get item abilities for a user - can be directly used by controllers
 */
export async function getItemAbility(user: AuthenticatedUser): Promise<MongoAbility<any>> {
    const builder = createAbilityBuilder();
    await setupItemAbilities(builder, user);
    return builder.build();
}
