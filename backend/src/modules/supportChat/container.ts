import { ContainerModule } from 'inversify';
import { SUPPORT_CHAT_TYPES } from './types.js';
import { FAQRepository, SupportQuestionRepository } from './repositories/providers/mongodb/index.js';
import { ChatService, FAQRetrievalService, AdminService } from './services/index.js';
import { ChatController, AdminController } from './controllers/index.js';

// Everything here is injected by symbol, and the symbol bindings carry the
// singleton scope: without it each injection site gets its own instance, so
// per-service state (the retrieval service's embedding-provider cooldown) would
// never be shared between the learner and admin controllers.
export const supportChatContainerModule = new ContainerModule(options => {
  // Repositories
  options.bind(FAQRepository).toSelf().inSingletonScope();
  options.bind(SUPPORT_CHAT_TYPES.FAQRepo).to(FAQRepository).inSingletonScope();

  options.bind(SupportQuestionRepository).toSelf().inSingletonScope();
  options
    .bind(SUPPORT_CHAT_TYPES.SupportQuestionRepo)
    .to(SupportQuestionRepository)
    .inSingletonScope();

  // Services
  options.bind(FAQRetrievalService).toSelf().inSingletonScope();
  options
    .bind(SUPPORT_CHAT_TYPES.FAQRetrievalService)
    .to(FAQRetrievalService)
    .inSingletonScope();

  options.bind(ChatService).toSelf().inSingletonScope();
  options.bind(SUPPORT_CHAT_TYPES.ChatService).to(ChatService).inSingletonScope();

  options.bind(AdminService).toSelf().inSingletonScope();
  options.bind(SUPPORT_CHAT_TYPES.AdminService).to(AdminService).inSingletonScope();

  // Controllers
  options.bind(ChatController).toSelf().inSingletonScope();
  options.bind(AdminController).toSelf().inSingletonScope();
});
