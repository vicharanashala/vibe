import {Container, ContainerModule} from 'inversify';
import {RoutingControllersOptions, useContainer} from 'routing-controllers';
import {sharedContainerModule} from '#root/container.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {authContainerModule} from '../auth/container.js';
import {coursesContainerModule} from '../courses/container.js';
import {peerReviewsContainerModule} from './container.js';
import {ReflectionController} from './controllers/ReflectionController.js';
import {
  CreateReflectionBody,
  CreateReviewBody,
  InstructorPathParams,
  InstructorReflectionListQuery,
  InstructorStatsQuery,
  ReflectionIdPathParams,
  ReflectionScoresDto,
  SectionPathParams,
} from './classes/validators/ReflectionValidator.js';

export const peerReviewsContainerModules: ContainerModule[] = [
  peerReviewsContainerModule,
  sharedContainerModule,
  authContainerModule,
  coursesContainerModule,
];

export const peerReviewsModuleControllers: Function[] = [ReflectionController];

export async function setupPeerReviewsContainer(): Promise<void> {
  const container = new Container();
  await container.load(...peerReviewsContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const peerReviewsModuleOptions: RoutingControllersOptions = {
  controllers: peerReviewsModuleControllers,
  middlewares: [],
  defaultErrorHandler: true,
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};

export const peerReviewsModuleValidators: Function[] = [
  CreateReflectionBody,
  CreateReviewBody,
  ReflectionScoresDto,
  SectionPathParams,
  ReflectionIdPathParams,
  InstructorPathParams,
  InstructorReflectionListQuery,
  InstructorStatsQuery,
];

export * from './classes/index.js';
export * from './controllers/index.js';
export * from './services/index.js';
export * from './repositories/index.js';
export * from './types.js';
export * from './container.js';
export * from './constants.js';
