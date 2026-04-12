import { AbilityBuilder, createMongoAbility } from '@casl/ability';

// Scopes for anomaly permissions
export class AnomalyScope {
  courseId: string;
  versionId: string;
}

// Utility to create an ability builder
export function createAbilityBuilder() {
  return new AbilityBuilder(createMongoAbility);
}
