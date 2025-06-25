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
    Reorder = "reorder",
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
        const progress = await progressService.getUserProgress(user.userId, enrollment.courseId, enrollment.versionId);
        const completedItems = await progressService.getCompletedItems(user.userId, enrollment.courseId, enrollment.versionId);
        const courseBounded = { courseId: enrollment.courseId };
        const versionBounded = { courseId: enrollment.courseId, versionId: enrollment.versionId };
        
        // Create a condition that matches either the current item or any completed item
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

        switch (enrollment.role) {
            case 'student':
                can(ItemActions.ViewAll, 'Item', versionBounded);
                can(ItemActions.View, 'Item', itemBounded);
                break;
            case 'instructor':
                can(ItemActions.Create, 'Item', courseBounded);
                can(ItemActions.Modify, 'Item', courseBounded);
                can(ItemActions.Reorder, 'Item', courseBounded);
                can(ItemActions.Delete, 'Item', courseBounded);
                can(ItemActions.ViewAll, 'Item', courseBounded);
                break;
            case 'manager':
                can('manage', 'Item', courseBounded);
                break;
            case 'ta':
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
