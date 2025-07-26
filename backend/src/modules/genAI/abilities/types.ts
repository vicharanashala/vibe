import { AbilityBuilder, createMongoAbility } from '@casl/ability';

// Scope for GenAI permissions (expand if needed)
export class GenAIScope {
  jobId?: string;
  userId?: string;
}

// Utility to create an ability builder
export function createAbilityBuilder() {
  return new AbilityBuilder(createMongoAbility);
}
