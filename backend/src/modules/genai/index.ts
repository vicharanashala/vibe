import 'reflect-metadata';
import {sharedContainerModule} from '#root/container.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {Container, ContainerModule} from 'inversify';
import {RoutingControllersOptions, useContainer} from 'routing-controllers';
import {HttpErrorHandler} from '#shared/index.js';
import {genaiContainerModule} from './container.js';
import GenAIVideoController from './GenAIVideoController.js';


export const genaiContainerModules: ContainerModule[] = [
  genaiContainerModule,
  sharedContainerModule,
];

export const genaiModuleControllers: Function[] = [
  GenAIVideoController
];

export async function setupGenaiContainer(): Promise<void> {
  const container = new Container();
  await container.load(...genaiContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const genaiModuleOptions: RoutingControllersOptions = {
  controllers: genaiModuleControllers,
  middlewares: [HttpErrorHandler],
  defaultErrorHandler: false,
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};

export * from './GenAIVideoController.js';
