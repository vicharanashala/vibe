import { Container, ContainerModule } from 'inversify';
import { sharedContainerModule } from '#root/container.js';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { useContainer, RoutingControllersOptions } from 'routing-controllers';
import { peerReviewContainerModule } from './container.js';

export const peerReviewContainerModules: ContainerModule[] = [
  peerReviewContainerModule,
  sharedContainerModule,
];

export const peerReviewModuleControllers: Function[] = [];

export async function setupPeerReviewContainer(): Promise<void> {
  const container = new Container();
  await container.load(...peerReviewContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const peerReviewModuleOptions: RoutingControllersOptions = {
  controllers: peerReviewModuleControllers,
  middlewares: [],
  defaultErrorHandler: true,
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};