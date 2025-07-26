export * from './types.js';
export * from './anomalyAbilities.js';

import { AbilityBuilder } from '@casl/ability';
import { AuthenticatedUser } from '#shared/interfaces/models.js';
import { setupAnomalyAbilities } from './anomalyAbilities.js';

export function setupAllAnomalyAbilities(
  builder: AbilityBuilder<any>,
  user: AuthenticatedUser,
  subject?: string
) {
  if (subject) {
    switch (subject) {
      case 'Anomaly':
        setupAnomalyAbilities(builder, user);
        break;
    }
  } else {
    setupAnomalyAbilities(builder, user);
  }
}
