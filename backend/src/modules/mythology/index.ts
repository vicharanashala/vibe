import { Container, ContainerModule } from 'inversify';
import { sharedContainerModule } from '#root/container.js';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { useContainer, RoutingControllersOptions } from 'routing-controllers';
import { mythologyContainerModule } from './container.js';
import { MythologyController } from './controllers/MythologyController.js';

export const mythologyContainerModules: ContainerModule[] = [
  mythologyContainerModule,
  sharedContainerModule,
];

export const mythologyModuleControllers: Function[] = [
  MythologyController,
];

export const mythologyModuleValidators: Function[] = [];

export async function setupMythologyContainer(): Promise<void> {
  const container = new Container();
  await container.load(...mythologyContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const mythologyModuleOptions: RoutingControllersOptions = {
  controllers: mythologyModuleControllers,
  middlewares: [],
  defaultErrorHandler: true,
};
