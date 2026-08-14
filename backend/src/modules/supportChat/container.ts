import { ContainerModule } from 'inversify';
import { SUPPORT_CHAT_TYPES } from './types.js';
import { FAQRepository, SupportQuestionRepository } from './repositories/providers/mongodb/index.js';
import { ChatService, FAQRetrievalService, AdminService } from './services/index.js';
import { ChatController, AdminController } from './controllers/index.js';

export const supportChatContainerModule = new ContainerModule(options => {
  // Repositories
  options.bind(FAQRepository).toSelf().inSingletonScope();
  options.bind(SUPPORT_CHAT_TYPES.FAQRepo).to(FAQRepository);

  options.bind(SupportQuestionRepository).toSelf().inSingletonScope();
  options.bind(SUPPORT_CHAT_TYPES.SupportQuestionRepo).to(SupportQuestionRepository);

  // Services
  options.bind(FAQRetrievalService).toSelf().inSingletonScope();
  options.bind(SUPPORT_CHAT_TYPES.FAQRetrievalService).to(FAQRetrievalService);

  options.bind(ChatService).toSelf().inSingletonScope();
  options.bind(SUPPORT_CHAT_TYPES.ChatService).to(ChatService);

  options.bind(AdminService).toSelf().inSingletonScope();
  options.bind(SUPPORT_CHAT_TYPES.AdminService).to(AdminService);

  // Controllers
  options.bind(ChatController).toSelf().inSingletonScope();
  options.bind(AdminController).toSelf().inSingletonScope();
});
