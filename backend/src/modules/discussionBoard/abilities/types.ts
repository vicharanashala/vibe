import {AbilityBuilder, createMongoAbility} from '@casl/ability';

export function createDiscussionAbilityBuilder() {
  return new AbilityBuilder(createMongoAbility);
}