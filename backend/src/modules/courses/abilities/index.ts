export * from './courseAbilities.js';
export * from './versionAbilities.js';
export * from './itemAbilities.js';
export * from './types.js';

// Unified setup function for all course abilities
import { AbilityBuilder } from '@casl/ability';
import { AuthenticatedUser } from '#shared/interfaces/models.js';
import { setupCourseAbilities } from './courseAbilities.js';
import { setupCourseVersionAbilities } from './versionAbilities.js';
import { setupItemAbilities } from './itemAbilities.js';

export async function setupAllCourseAbilities(
    builder: AbilityBuilder<any>,
    user: AuthenticatedUser,
    subject?: string
) {
    // If a specific subject is provided, we can conditionally setup abilities
    if (subject) {
        switch (subject) {
            case 'Course':
                setupCourseAbilities(builder, user);
                break;
            case 'CourseVersion':
                setupCourseVersionAbilities(builder, user);
                break;
            case 'Item':
                await setupItemAbilities(builder, user);
                break;
        }
    } else {
        // If no specific subject, setup all course-related abilities
        setupCourseAbilities(builder, user);
        setupCourseVersionAbilities(builder, user);
        await setupItemAbilities(builder, user);
    }
}