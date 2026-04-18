import { Container, ContainerModule } from 'inversify';
import { CourseSettingController } from './controllers/CourseSettingController.js';import { sharedContainerModule } from '#root/container.js';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { useContainer, RoutingControllersOptions } from 'routing-controllers';
import { settingContainerModule } from './container.js';
import { authContainerModule } from '../auth/container.js';
import { UserSettingController } from './controllers/UserSettingController.js';

export const settingContainerModules: ContainerModule[] = [
  settingContainerModule,
  sharedContainerModule,
  authContainerModule
];

export const settingModuleControllers: Function[] = [
  CourseSettingController,
  UserSettingController
];

export async function setupSettingContainer(): Promise<void> {
  const container = new Container();
  await container.load(...settingContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const settingModuleOptions: RoutingControllersOptions = {
  controllers: settingModuleControllers,
  middlewares: [],
  defaultErrorHandler: true,
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};

export * from '../setting/classes/index.js';
export * from './controllers/index.js';
export * from './services/index.js';
export * from './types.js';
export * from './container.js';
