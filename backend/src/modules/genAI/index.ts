import { Container, ContainerModule } from 'inversify';
import { sharedContainerModule } from '#root/container.js';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { useContainer, RoutingControllersOptions } from 'routing-controllers';
import { genAIContainerModule } from './container.js';
import { GenAIController } from './controllers/GenAIController.js';
import { WebhookController } from './controllers/WebhookController.js';
import { ConceptMapController } from './controllers/ConceptMapController.js';
import { GENAI_VALIDATORS } from './classes/validators/GenAIValidators.js';

export const genAIContainerModules: ContainerModule[] = [
  genAIContainerModule,
  sharedContainerModule,
];

export const genAIModuleControllers: Function[] = [
  GenAIController,
  WebhookController,
  ConceptMapController,
];

// GENAI_VALIDATORS also holds plain enum objects (JobType, TaskStatus);
// only class constructors are usable as OpenAPI validator schemas.
export const genAIModuleValidators: Function[] = (
  GENAI_VALIDATORS as unknown[]
).filter((v): v is Function => typeof v === 'function');

export async function setupGenAIContainer(): Promise<void> {
  const container = new Container();
  await container.load(...genAIContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const genAIModuleOptions: RoutingControllersOptions = {
  controllers: genAIModuleControllers,
  middlewares: [],
  defaultErrorHandler: true,
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};
