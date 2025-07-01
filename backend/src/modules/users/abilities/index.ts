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
    user: AuthenticatedUser,
    subject?: string
) {
    // If a specific subject is provided, we can conditionally setup abilities
    if (subject) {
        switch (subject) {
            case 'Enrollment':
                setupEnrollmentAbilities(builder, user);
                break;
            case 'Progress':
                setupProgressAbilities(builder, user);
                break;
        }
    }
    // If no specific subject, setup all user-related abilities
    else {
        setupEnrollmentAbilities(builder, user);
        setupProgressAbilities(builder, user);
    }
}
