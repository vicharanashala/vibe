import { AbilityBuilder, createMongoAbility } from "@casl/ability";

// Scopes
export class InviteScope {
    userId: string;
    courseId?: string;
    versionId?: string;
}

// Common utility function to create an ability builder
export function createAbilityBuilder() {
    return new AbilityBuilder(createMongoAbility);
}
