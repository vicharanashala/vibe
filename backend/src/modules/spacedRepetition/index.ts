import { sharedContainerModule } from '#root/container.js';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { Container, ContainerModule } from 'inversify';
import { RoutingControllersOptions, useContainer } from 'routing-controllers';
import { spacedRepetitionContainerModule } from './container.js';
import { SpacedRepetitionController } from './controllers/SpacedRepetitionController.js';
import { authContainerModule } from '../auth/container.js';
import { usersContainerModule } from '../users/container.js';
import { notificationsContainerModule } from '../notifications/container.js';

export const spacedRepetitionContainerModules: ContainerModule[] = [
  spacedRepetitionContainerModule,
  sharedContainerModule,
  authContainerModule,
  usersContainerModule,
  notificationsContainerModule,
];

export const spacedRepetitionModuleControllers: Function[] = [
  SpacedRepetitionController,
];

export async function setupSpacedRepetitionContainer(): Promise<void> {
  const container = new Container();
  await container.load(...spacedRepetitionContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const spacedRepetitionModuleOptions: RoutingControllersOptions = {
  controllers: spacedRepetitionModuleControllers,
  middlewares: [],
  defaultErrorHandler: true,
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};

// No validators needed for this module — request validation is handled
// entirely via class-validator decorators on the body/param classes.
export const spacedRepetitionModuleValidators: Function[] = [];