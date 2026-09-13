import { AbilityBuilder, createMongoAbility } from '@casl/ability';

// Scopes
export class SupportChatScope {
  courseId?: string;
}

// Common utility function to create an ability builder
export function createSupportChatAbilityBuilder() {
  return new AbilityBuilder(createMongoAbility);
}
