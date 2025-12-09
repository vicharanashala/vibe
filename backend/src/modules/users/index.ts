import {authContainerModule} from '#auth/container.js';
import {sharedContainerModule} from '#root/container.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {Container, ContainerModule} from 'inversify';
import {RoutingControllersOptions, useContainer} from 'routing-controllers';
import {usersContainerModule} from './container.js';
import {UserController} from './controllers/UserController.js';
import { USER_VALIDATORS } from './classes/validators/index.js';


export const usersContainerModules: ContainerModule[] = [
  usersContainerModule,
  sharedContainerModule,
  authContainerModule,
];

export const usersModuleControllers: Function[] = [
  UserController,
];

export async function setupUsersContainer(): Promise<void> {
  const container = new Container();
  await container.load(...usersContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const usersModuleOptions: RoutingControllersOptions = {
  controllers: usersModuleControllers,
  middlewares: [],
  defaultErrorHandler: true,
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};

export const usersModuleValidators: Function[] = [
  ...USER_VALIDATORS
]