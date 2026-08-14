import { ContainerModule } from 'inversify';
import { CHATBOT_TYPES } from './types.js';
import { ChatbotService } from './services/ChatbotService.js';
import { ChatbotController } from './controllers/ChatbotController.js';

export const chatbotContainerModule = new ContainerModule(options => {
  options.bind(CHATBOT_TYPES.ChatbotService).to(ChatbotService).inSingletonScope();
  options.bind(ChatbotController).toSelf().inSingletonScope();
});
