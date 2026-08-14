import { Container, ContainerModule } from 'inversify';
import { sharedContainerModule } from '#root/container.js';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { useContainer, RoutingControllersOptions } from 'routing-controllers';
import { chatbotContainerModule } from './container.js';
import { ChatbotController } from './controllers/ChatbotController.js';
import { ChatbotQueryBody } from './classes/validators/ChatbotValidators.js';

export const chatbotContainerModules: ContainerModule[] = [
  chatbotContainerModule,
  sharedContainerModule,
];

export const chatbotModuleControllers: Function[] = [
  ChatbotController,
];

export const chatbotModuleValidators: Function[] = [
  ChatbotQueryBody,
];

export async function setupChatbotContainer(): Promise<void> {
  const container = new Container();
  await container.load(...chatbotContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const chatbotModuleOptions: RoutingControllersOptions = {
  controllers: chatbotModuleControllers,
  middlewares: [],
  defaultErrorHandler: true,
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};
