export * from './types.js';
export * from './enrollmentAbilities.js';
export * from './progressAbilities.js';

// Unified setup function for all user abilities
import { AbilityBuilder } from '@casl/ability';
import { AuthenticatedUser } from '#shared/interfaces/models.js';
import { setupEnrollmentAbilities } from './enrollmentAbilities.js';
import { setupProgressAbilities } from './progressAbilities.js';

export function setupAllUserAbilities(
    builder: AbilityBuilder<any>,
    user: AuthenticatedUser
) {
    setupEnrollmentAbilities(builder, user);
    setupProgressAbilities(builder, user);
}
