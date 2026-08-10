import { ContainerModule } from 'inversify';
import { DuelRepository } from './repositories/DuelRepository.js';
import { DuelService } from './services/DuelService.js';
import { DuelController } from './controllers/DuelController.js';
import { DUELS_TYPES } from './types.js';

export const duelsContainerModule = new ContainerModule(bind => {
  bind.bind<DuelRepository>(DUELS_TYPES.DuelRepository).to(DuelRepository).inSingletonScope();
  bind.bind<DuelService>(DUELS_TYPES.DuelService).to(DuelService).inSingletonScope();
  bind.bind<DuelController>(DuelController).toSelf().inSingletonScope();
});
