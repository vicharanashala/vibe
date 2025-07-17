import { AbilityBuilder, createMongoAbility } from "@casl/ability";

// Scopes
export class EnrollmentScope {
    courseId: string;
    versionId: string;
    userId?: string;
}

export class ProgressScope {
    courseId: string;
    versionId: string;
    userId: string;
}

// Common utility function to create an ability builder
export function createAbilityBuilder() {
    return new AbilityBuilder(createMongoAbility);
}
