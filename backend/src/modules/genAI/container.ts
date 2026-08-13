import { ContainerModule } from 'inversify';
import { GENAI_TYPES } from './types.js';
import { GenAIService } from './services/GenAIService.js';
import { WebhookService } from './services/WebhookService.js';
import { GenAIController } from './controllers/GenAIController.js';
import { WebhookController } from './controllers/WebhookController.js';
import { GenAIRepository } from './repositories/providers/mongodb/GenAIRepository.js';
import { ConceptMapRepository } from './repositories/providers/mongodb/ConceptMapRepository.js';
import { SseService } from './services/sseService.js';
import { ConceptMapService } from './services/ConceptMapService.js';
import { ConceptMapController } from './controllers/ConceptMapController.js';

export const genAIContainerModule = new ContainerModule(options => {
  // Repositories
  options.bind(GENAI_TYPES.GenAIRepository).to(GenAIRepository);
  options.bind(GENAI_TYPES.ConceptMapRepo).to(ConceptMapRepository);
  // Services
  options.bind(GENAI_TYPES.GenAIService).to(GenAIService).inSingletonScope();
  options.bind(GENAI_TYPES.WebhookService).to(WebhookService).inSingletonScope();
  options.bind(GENAI_TYPES.SseService).to(SseService).inSingletonScope();
  options.bind(GENAI_TYPES.ConceptMapService).to(ConceptMapService).inSingletonScope();
  // Controllers
  options.bind(GenAIController).toSelf().inSingletonScope();
  options.bind(WebhookController).toSelf().inSingletonScope();
  options.bind(ConceptMapController).toSelf().inSingletonScope();
});
