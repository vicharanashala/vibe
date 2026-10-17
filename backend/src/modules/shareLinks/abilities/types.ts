import {AbilityBuilder, createMongoAbility} from '@casl/ability';

// Scopes
export class ShareLinkScope {
  userId: string;
  courseId?: string;
  versionId?: string;
}

// Common utility function to create an ability builder
export function createAbilityBuilder() {
  return new AbilityBuilder(createMongoAbility);
}
