export * from './types.js';
export * from './quizAbilities.js';
export * from './questionAbilities.js';
export * from './questionBankAbilities.js';
export * from './attemptAbilities.js';

// Unified setup function for all quiz abilities
import { AbilityBuilder } from '@casl/ability';
import { AuthenticatedUser } from '#shared/interfaces/models.js';
import { setupQuizAbilities } from './quizAbilities.js';
import { setupQuestionAbilities } from './questionAbilities.js';
import { setupQuestionBankAbilities } from './questionBankAbilities.js';
import { setupAttemptAbilities } from './attemptAbilities.js';

export function setupAllQuizAbilities(
    builder: AbilityBuilder<any>,
    user: AuthenticatedUser
) {
    setupQuizAbilities(builder, user);
    setupQuestionAbilities(builder, user);
    setupQuestionBankAbilities(builder, user);
    setupAttemptAbilities(builder, user);
}