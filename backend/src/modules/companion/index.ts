import {sharedContainerModule} from '#root/container.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {Container, ContainerModule} from 'inversify';
import {RoutingControllersOptions, useContainer} from 'routing-controllers';
import {companionContainerModule} from './container.js';
import {CompanionController} from './controllers/CompanionController.js';
import {coursesContainerModule} from '#courses/container.js';
import {authContainerModule} from '../auth/container.js';
import {notificationsContainerModule} from '../notifications/container.js';
import {usersContainerModule} from '../users/container.js';
import {quizzesContainerModule} from '../quizzes/container.js';

export const companionContainerModules: ContainerModule[] = [
  companionContainerModule,
  sharedContainerModule,
  coursesContainerModule,
  authContainerModule,
  notificationsContainerModule,
  usersContainerModule,
  quizzesContainerModule,
];

export const companionModuleControllers: Function[] = [CompanionController];

export async function setupCompanionContainer(): Promise<void> {
  const container = new Container();
  await container.load(...companionContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const companionModuleOptions: RoutingControllersOptions = {
  controllers: companionModuleControllers,
  middlewares: [],
  defaultErrorHandler: true,
  authorizationChecker: async () => true,
  validation: true,
};