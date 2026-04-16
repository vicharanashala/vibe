import { Container, ContainerModule } from 'inversify';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import {
  RoutingControllersOptions,
  useContainer,
} from 'routing-controllers';
import { authorizationChecker, HttpErrorHandler } from '#root/shared/index.js';
import { emotionsContainerModule } from './container.js';
import { EmotionController } from './controllers/EmotionController.js';
import { sharedContainerModule } from '#root/container.js';
import { authContainerModule } from '#auth/container.js';

export const emotionsContainerModules: ContainerModule[] = [
  emotionsContainerModule,
  sharedContainerModule,
  authContainerModule,
];

export const emotionsModuleControllers: Function[] = [EmotionController];

export async function setupEmotionsContainer(): Promise<void> {
  const container = new Container();
  await container.load(...emotionsContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const emotionsModuleOptions: RoutingControllersOptions = {
  controllers: emotionsModuleControllers,
  middlewares: [HttpErrorHandler],
  defaultErrorHandler: false,
  authorizationChecker,
  validation: true,
};

export const emotionsModuleValidators: Function[] = [];

export * from "./types.js";
export * from "./services/EmotionService.js";
export * from "./repositories/EmotionRepository.js";
export * from "./controllers/EmotionController.js";
export * from './container.js';
