import { ContainerModule } from 'inversify';
import { HP_SYSTEM_TYPES } from './types.js';
import { ActivityController } from './controllers/activityController.js';
import { ActivityService } from './services/activityService.js';
import { ActivityRepository } from './repositories/providers/mongodb/activityRepository.js';
import { ActivitySubmissionsController } from './controllers/activitySubmissionsController.js';
import { LedgerController } from './controllers/ledgerController.js';
import { ActivitySubmissionsService } from './services/activitySubmissionsService.js';
import { LedgerService } from './services/ledgerService.js';
import { RuleConfigService } from './services/ruleConfigsService.js';
import { RuleConfigsController } from './controllers/ruleConfigsController.js';
import { ActivitySubmissionsRepository, LedgerRepository, RuleConfigsRepository } from './repositories/index.js';
import { CohortsController } from './controllers/cohortsController.js';
import { CohortsService } from './services/cohortsService.js';

export const hpSystemContainerModule = new ContainerModule(options => {
    // Controllers
    options.bind(CohortsController).toSelf().inSingletonScope();
    options.bind(ActivityController).toSelf().inSingletonScope();
    options.bind(ActivitySubmissionsController).toSelf().inSingletonScope();
    options.bind(LedgerController).toSelf().inSingletonScope();
    options.bind(RuleConfigsController).toSelf().inSingletonScope();

    // Services
    options.bind(HP_SYSTEM_TYPES.cohortsService).to(CohortsService).inSingletonScope();
    options.bind(HP_SYSTEM_TYPES.activityService).to(ActivityService).inSingletonScope();
    options.bind(HP_SYSTEM_TYPES.activitySubmissionsService).to(ActivitySubmissionsService).inSingletonScope();
    options.bind(HP_SYSTEM_TYPES.ledgerService).to(LedgerService).inSingletonScope();
    options.bind(HP_SYSTEM_TYPES.ruleConfigsService).to(RuleConfigService).inSingletonScope();

    // Repositories
    options.bind(HP_SYSTEM_TYPES.activityRepository).to(ActivityRepository);
    options.bind(HP_SYSTEM_TYPES.activitySubmissionsRepository).to(ActivitySubmissionsRepository);
    options.bind(HP_SYSTEM_TYPES.ledgerRepository).to(LedgerRepository);
    options.bind(HP_SYSTEM_TYPES.ruleConfigsRepository).to(RuleConfigsRepository);
});
