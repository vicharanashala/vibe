import { ContainerModule, interfaces } from 'inversify';
import { SUPPORT_CHAT_TYPES } from './types.js';
import { FAQRepository, SupportQuestionRepository } from './repositories/providers/mongodb/index.js';
import { ChatService, FAQRetrievalService, AdminService } from './services/index.js';
import { ChatController, AdminController } from './controllers/index.js';

export const supportChatContainerModule = new ContainerModule(
  (bind: interfaces.Bind) => {
    // Repositories
    bind(FAQRepository).toSelf().inSingletonScope();
    bind(SUPPORT_CHAT_TYPES.FAQRepo).to(FAQRepository);

    bind(SupportQuestionRepository).toSelf().inSingletonScope();
    bind(SUPPORT_CHAT_TYPES.SupportQuestionRepo).to(SupportQuestionRepository);

    // Services
    bind(FAQRetrievalService).toSelf().inSingletonScope();
    bind(SUPPORT_CHAT_TYPES.FAQRetrievalService).to(FAQRetrievalService);

    bind(ChatService).toSelf().inSingletonScope();
    bind(SUPPORT_CHAT_TYPES.ChatService).to(ChatService);

    bind(AdminService).toSelf().inSingletonScope();
    bind(SUPPORT_CHAT_TYPES.AdminService).to(AdminService);

    // Controllers
    bind(ChatController).toSelf();
    bind(AdminController).toSelf();
  }
);
