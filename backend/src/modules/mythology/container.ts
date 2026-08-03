import { ContainerModule } from 'inversify';
import { MYTHOLOGY_TYPES } from './types.js';
import { MythologyService } from './services/MythologyService.js';
import { MythologyController } from './controllers/MythologyController.js';
import { MythologyRepository } from './repositories/providers/mongodb/MythologyRepository.js';

export const mythologyContainerModule = new ContainerModule((options) => {
  // Repository — MongoDB Atlas persistence layer for leaderboard
  options.bind<MythologyRepository>(MYTHOLOGY_TYPES.MythologyRepository)
    .to(MythologyRepository)
    .inSingletonScope();

  // Service — business logic, Cohere AI, leaderboard management
  options.bind<MythologyService>(MYTHOLOGY_TYPES.MythologyService)
    .to(MythologyService)
    .inSingletonScope();

  // Controller — REST routing
  options.bind(MythologyController).toSelf().inSingletonScope();
});
