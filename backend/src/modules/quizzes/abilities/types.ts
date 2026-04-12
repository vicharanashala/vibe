import { AbilityBuilder, createMongoAbility } from "@casl/ability";

// Scopes
export class QuizScope {
    quizId: string;
    courseId?: string;
    userId?: string;
}

export class QuestionScope {
    questionId: string;
    quizId?: string;
    courseId?: string;
    userId?: string;
}

export class QuestionBankScope {
    questionBankId: string;
    courseId?: string;
    userId?: string;
}

export class AttemptScope {
    attemptId: string;
    quizId?: string;
    userId?: string;
    courseId?: string;
}

export class SubmissionScope {
    submissionId: string;
    attemptId?: string;
    quizId?: string;
    userId?: string;
    courseId?: string;
}

// Common utility function to create an ability builder
export function createAbilityBuilder() {
    return new AbilityBuilder(createMongoAbility);
}
