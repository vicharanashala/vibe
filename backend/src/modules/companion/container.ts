import {ContainerModule} from 'inversify';
import {COMPANION_TYPES} from './types.js';
import {CompanionRepository} from './repositories/providers/mongodb/CompanionRepository.js';
import {CompanionService} from './services/CompanionService.js';
import {CompanionController} from './controllers/CompanionController.js';

export const companionContainerModule = new ContainerModule(options => {
  options
    .bind(COMPANION_TYPES.CompanionRepo)
    .to(CompanionRepository)
    .inSingletonScope();

  options
    .bind(COMPANION_TYPES.CompanionService)
    .to(CompanionService)
    .inSingletonScope();

  options.bind(CompanionController).toSelf().inSingletonScope();
});