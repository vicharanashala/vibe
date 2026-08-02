import { ContainerModule } from 'inversify';
import { MYTHOLOGY_TYPES } from './types.js';
import { MythologyService } from './services/MythologyService.js';
import { MythologyController } from './controllers/MythologyController.js';

export const mythologyContainerModule = new ContainerModule((options) => {
  options.bind<MythologyService>(MYTHOLOGY_TYPES.MythologyService).to(MythologyService).inSingletonScope();
  options.bind(MythologyController).toSelf().inSingletonScope();
});
