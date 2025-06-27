import { AbilityBuilder, MongoAbility } from "@casl/ability";
import { AuthenticatedUser, AuthenticatedUserEnrollements } from "#root/shared/interfaces/models.js";
import { ItemScope, createAbilityBuilder } from './types.js';
import { getFromContainer, InternalServerError } from "routing-controllers";
import { ProgressService } from "#root/modules/users/services/ProgressService.js";

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
export function setupItemAbilities(
    builder: AbilityBuilder<any>,
    user: AuthenticatedUser
) {
    const { can, cannot } = builder;
    
    if (user.globalRole === 'admin') {
        can('manage', 'Item');
        return;
    }
    const progressService = getFromContainer(ProgressService);
    user.enrollments.forEach(async (enrollment: AuthenticatedUserEnrollements) =>{
        const versionBounded = { versionId: enrollment.versionId };
        
        switch (enrollment.role) {
            case 'STUDENT':
                can(ItemActions.ViewAll, 'Item', versionBounded);
                const progress = await progressService.getUserProgress(user.userId, enrollment.courseId, enrollment.versionId);
                const completedItems = await progressService.getCompletedItems(user.userId, enrollment.courseId, enrollment.versionId);
                if (!progress) {
                    throw new InternalServerError('No progress found for user');
                }
                const allowedItemIds = [...completedItems];
                allowedItemIds.push(progress.currentItem.toString());
                const itemBounded = { 
                    userId: user.userId, 
                    courseId: enrollment.courseId, 
                    versionId: enrollment.versionId,
                    itemId: { $in: allowedItemIds }
                };
                can(ItemActions.View, 'Item', itemBounded);
                break;
            case 'INSTRUCTOR':
                can(ItemActions.Create, 'Item', versionBounded);
                can(ItemActions.Modify, 'Item', versionBounded);
                can(ItemActions.Delete, 'Item', versionBounded);
                can(ItemActions.ViewAll, 'Item', versionBounded);
                break;
            case 'MANAGER':
                can('manage', 'Item', versionBounded);
                break;
            case 'TA':
                can(ItemActions.ViewAll, 'Item', versionBounded);
                break;
        }
    });
}

/**
 * Get item abilities for a user - can be directly used by controllers
 */
export function getItemAbility(user: AuthenticatedUser): MongoAbility<any> {
    const builder = createAbilityBuilder();
    setupItemAbilities(builder, user);
    return builder.build();
}
