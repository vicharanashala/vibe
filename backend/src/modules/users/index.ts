import {authContainerModule} from '#auth/container.js';
import {sharedContainerModule} from '#root/container.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {Container} from 'inversify';
import {RoutingControllersOptions, useContainer} from 'routing-controllers';
import {usersContainerModule} from './container.js';
import {EnrollmentController} from './controllers/EnrollmentController.js';
import {ProgressController} from './controllers/ProgressController.js';
import {UserController} from './controllers/UserController.js';

export async function setupUsersContainer(): Promise<void> {
  const container = new Container();
  await container.load(
    sharedContainerModule,
    authContainerModule,
    usersContainerModule,
  );
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const usersModuleOptions: RoutingControllersOptions = {
  controllers: [EnrollmentController, ProgressController, UserController],
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
export * from './types.js';
export * from './container.js';
