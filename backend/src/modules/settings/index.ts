import {authContainerModule} from '#auth/container.js';
import {sharedContainerModule} from '#root/container.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {Container} from 'inversify';
import {RoutingControllersOptions, useContainer} from 'routing-controllers';
import {settingsContainerModule} from './container.js';
import {CourseSettingsController} from './controllers/index.js';
import {UserSettingsController} from './controllers/UserSettingsController.js';

export async function setupSettingsContainer(): Promise<void> {
  const container = new Container();
  await container.load(
    sharedContainerModule,
    authContainerModule,
    settingsContainerModule,
  );
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const settingsModuleOptions: RoutingControllersOptions = {
  controllers: [CourseSettingsController, UserSettingsController],
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
