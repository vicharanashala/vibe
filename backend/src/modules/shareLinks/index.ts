import {Container, ContainerModule} from 'inversify';
import {sharedContainerModule} from '#root/container.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {RoutingControllersOptions, useContainer} from 'routing-controllers';
import {ShareLinkController} from './controllers/ShareLinkController.js';
import {shareLinksContainerModule} from './container.js';
import {usersContainerModule} from '#root/modules/users/container.js';
import {coursesContainerModule} from '#root/modules/courses/container.js';
import {authContainerModule} from '#root/modules/auth/container.js';
import {notificationsContainerModule} from '#root/modules/notifications/container.js';

export const shareLinksModuleControllers: Function[] = [ShareLinkController];

export const shareLinksContainerModules: ContainerModule[] = [
  shareLinksContainerModule,
  sharedContainerModule,
  usersContainerModule,
  coursesContainerModule,
  authContainerModule,
  notificationsContainerModule,
];

export async function setupShareLinksContainer(): Promise<void> {
  const container = new Container();
  await container.load(...shareLinksContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const shareLinksModuleOptions: RoutingControllersOptions = {
  controllers: [ShareLinkController],
  middlewares: [],
  defaultErrorHandler: true,
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};

export * from './classes/index.js';
export * from './controllers/index.js';
export * from './services/index.js';
export * from './abilities/index.js';
export * from './container.js';
