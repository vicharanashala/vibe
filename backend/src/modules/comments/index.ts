import {Container, ContainerModule} from 'inversify';
import {RoutingControllersOptions, useContainer} from 'routing-controllers';
import {sharedContainerModule} from '#root/container.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {authContainerModule} from '../auth/container.js';
import {coursesContainerModule} from '../courses/container.js';
import {commentsContainerModule} from './container.js';
import {CommentController} from './controllers/CommentController.js';
import {CommentItemPathParams, CreateCommentBody} from './classes/validators/CommentValidators.js';

export const commentsContainerModules: ContainerModule[] = [
  commentsContainerModule,
  sharedContainerModule,
  authContainerModule,
  // ItemRepository (COURSES_TYPES.ItemRepo) — CommentService uses it to
  // verify an itemId actually belongs to the claimed course version.
  coursesContainerModule,
];

export const commentsModuleControllers: Function[] = [CommentController];

export async function setupCommentsContainer(): Promise<void> {
  const container = new Container();
  await container.load(...commentsContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const commentsModuleOptions: RoutingControllersOptions = {
  controllers: commentsModuleControllers,
  middlewares: [],
  defaultErrorHandler: true,
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};

export const commentsModuleValidators: Function[] = [CommentItemPathParams, CreateCommentBody];

export * from './classes/index.js';
export * from './controllers/index.js';
export * from './services/index.js';
export * from './repositories/index.js';
export * from './types.js';
export * from './container.js';
export * from './constants.js';
