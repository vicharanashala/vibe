export * from './types.js';
export * from './inviteAbilities.js';

// Unified setup function for all notification abilities
import { AbilityBuilder } from '@casl/ability';
import { AuthenticatedUser } from '#shared/interfaces/models.js';
import { setupInviteAbilities } from './inviteAbilities.js';

export function setupAllNotificationAbilities(
    builder: AbilityBuilder<any>,
    user: AuthenticatedUser
) {
    setupInviteAbilities(builder, user);
}
