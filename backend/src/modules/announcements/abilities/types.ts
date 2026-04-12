import { AbilityBuilder, createMongoAbility } from '@casl/ability';

// Scopes
export class AnnouncementScope {
    userId: string;
    courseId?: string;
    versionId?: string;
}

// Common utility function to create an ability builder
export function createAnnouncementAbilityBuilder() {
    return new AbilityBuilder(createMongoAbility);
}
