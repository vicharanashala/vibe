import { ContainerModule } from 'inversify';
import { ASK_BETAL_TYPES } from './types.js';
import { AskBetalService } from './services/AskBetalService.js';
import { AskBetalController } from './controllers/AskBetalController.js';

export const askBetalContainerModule = new ContainerModule(bind => {
  bind.bind<AskBetalService>(ASK_BETAL_TYPES.AskBetalService).to(AskBetalService).inSingletonScope();
  bind.bind<AskBetalController>(AskBetalController).toSelf().inSingletonScope();
});
