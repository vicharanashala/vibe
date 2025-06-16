import { ContainerModule } from 'inversify';
import { LLMController } from './controllers/LLMController.js';import { GENAI_TYPES } from './types.js';

export const genaiContainerModule = new ContainerModule(options => {
  options.bind(LLMController).toSelf().inSingletonScope();

  // Repositories

  // Services

  // Controllers
});
