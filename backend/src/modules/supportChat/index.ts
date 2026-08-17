import {Container, ContainerModule} from 'inversify';
import {RoutingControllersOptions, useContainer} from 'routing-controllers';
import {sharedContainerModule} from '#root/container.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {authContainerModule} from '../auth/container.js';
import {supportChatContainerModule} from './container.js';
import {AdminController, ChatController} from './controllers/index.js';
import {
  AdminDashboardQuery,
  AdminFAQListQuery,
  AdminQuestionsQuery,
  AdminResponseBody,
  ChatHistoryQuery,
  ChatMessageBody,
  ChatMessageQuery,
  CreateFAQBody,
  EscalateQuestionBody,
  FAQPathParams,
  FAQSearchQuery,
  RateQuestionBody,
  SupportChatContextDto,
  SupportQuestionPathParams,
  UpdateFAQBody,
} from './classes/validators/SupportChatValidators.js';

export const supportChatContainerModules: ContainerModule[] = [
  supportChatContainerModule,
  sharedContainerModule,
  authContainerModule,
];

export const supportChatModuleControllers: Function[] = [
  ChatController,
  AdminController,
];

export async function setupSupportChatContainer(): Promise<void> {
  const container = new Container();
  await container.load(...supportChatContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const supportChatModuleOptions: RoutingControllersOptions = {
  controllers: supportChatModuleControllers,
  middlewares: [],
  defaultErrorHandler: true,
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};

export const supportChatModuleValidators: Function[] = [
  SupportChatContextDto,
  ChatMessageBody,
  ChatMessageQuery,
  ChatHistoryQuery,
  SupportQuestionPathParams,
  RateQuestionBody,
  EscalateQuestionBody,
  FAQSearchQuery,
  AdminDashboardQuery,
  AdminQuestionsQuery,
  AdminResponseBody,
  FAQPathParams,
  AdminFAQListQuery,
  CreateFAQBody,
  UpdateFAQBody,
];

export * from './abilities/index.js';
export * from './classes/validators/SupportChatValidators.js';
export * from './controllers/index.js';
export * from './services/index.js';
export * from './repositories/providers/mongodb/index.js';
export * from './types.js';
export * from './container.js';
