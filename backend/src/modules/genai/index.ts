import { Container, ContainerModule } from 'inversify';
import { LLMController } from './controllers/LLMController.js';import { sharedContainerModule } from '#root/container.js';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { useContainer, RoutingControllersOptions } from 'routing-controllers';
import { genaiContainerModule } from './container.js';

export const genaiContainerModules: ContainerModule[] = [
  genaiContainerModule,
  sharedContainerModule,
];

export const genaiModuleControllers: Function[] = [
  LLMController,
];

export async function setupGenaiContainer(): Promise<void> {
  const container = new Container();
  await container.load(...genaiContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const genaiModuleOptions: RoutingControllersOptions = {
  controllers: genaiModuleControllers,
  middlewares: [],
  defaultErrorHandler: true,
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};
