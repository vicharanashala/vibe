import {Container, ContainerModule} from 'inversify';
import {sharedContainerModule} from '#root/container.js';
import {usersContainerModule} from '#root/modules/users/container.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {
  RoutingControllersOptions,
  useContainer,
} from 'routing-controllers';
import {discussionBoardContainerModule} from './container.js';
import {DiscussionController} from './controllers/DiscussionController.js';
import {DISCUSSION_VALIDATORS} from './classes/validators/DiscussionValidators.js';

export const discussionBoardContainerModules: ContainerModule[] = [
  discussionBoardContainerModule,
  sharedContainerModule,
  usersContainerModule,
];

export const discussionBoardModuleControllers: Function[] = [
  DiscussionController,
];

export async function setupDiscussionBoardContainer(): Promise<void> {
  const container = new Container();
  await container.load(...discussionBoardContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

/**
 * Routing-controllers options used by the standalone "discussionBoard"
 * module entry. The auto-loader in `bootstrap/loadModules.ts` registers
 * this when the app is started with `MODULE=discussionBoard`; the all-modules
 * boot path doesn't need it because the global `useExpressServer` already
 * wires `discussionBoardModuleControllers` from `loadAppModules("all")`.
 */
export const discussionBoardModuleOptions: RoutingControllersOptions = {
  controllers: discussionBoardModuleControllers,
  middlewares: [],
  defaultErrorHandler: true,
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};

export const discussionBoardModuleValidators: Function[] = [
  ...DISCUSSION_VALIDATORS,
];

export * from './classes/index.js';
export * from './controllers/index.js';
export * from './services/index.js';
export * from './abilities/index.js';
export * from './container.js';