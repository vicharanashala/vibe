import {AbilityBuilder, createMongoAbility} from '@casl/ability';

// Scopes
export class EjectionPolicyScope {
  courseId?: string;
  versionId?: string;
}

// Common utility function to create an ability builder
export function createAbilityBuilder() {
  return new AbilityBuilder(createMongoAbility);
}
