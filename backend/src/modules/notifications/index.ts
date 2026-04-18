import {Container, ContainerModule} from 'inversify';
import {sharedContainerModule} from '#root/container.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {
  RoutingControllersOptions,
  useContainer,
} from 'routing-controllers';
import {InviteController} from './controllers/InviteController.js';
import { notificationsContainerModule } from './container.js';
import {usersContainerModule} from '#root/modules/users/container.js';

export const notificationsModuleControllers: Function[] = [
  InviteController,
];


export const notificationsContainerModules: ContainerModule[] = [
  notificationsContainerModule,
  sharedContainerModule,
  usersContainerModule,
];


export async function setupNotificationsContainer(): Promise<void> {
  const container = new Container();
  await container.load(...notificationsContainerModules);  
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}
export const notificationsModuleOptions: RoutingControllersOptions = {
  controllers: [
    InviteController,
  ],
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
export * from './container.js';



