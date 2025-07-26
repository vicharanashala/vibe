export * from './types.js';
export * from './genAIAbilities.js';

import { AbilityBuilder } from '@casl/ability';
import { AuthenticatedUser } from '#shared/interfaces/models.js';
import { setupGenAIAbilities } from './genAIAbilities.js';

export function setupAllGenAIAbilities(
  builder: AbilityBuilder<any>,
  user: AuthenticatedUser,
  subject?: string
) {
  if (subject) {
    switch (subject) {
      case 'GenAI':
        setupGenAIAbilities(builder, user);
        break;
    }
  } else {
    setupGenAIAbilities(builder, user);
  }
}
