import { AbilityBuilder, createMongoAbility } from "@casl/ability";

// Scopes
export class CourseScope {
    courseId: string;
    userId: string;
}

export class CourseVersionScope {
    courseId: string;
    versionId: string;
    userId: string;
}

export class ItemScope {
    courseId: string;
    versionId: string;
    itemId: string;
    userId: string;
}

// Common utility function to create an ability builder
export function createAbilityBuilder() {
    return new AbilityBuilder(createMongoAbility);
}
