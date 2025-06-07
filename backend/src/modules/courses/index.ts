import {authContainerModule} from '#auth/container.js';
import {sharedContainerModule} from '#root/container.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {HttpErrorHandler} from '#shared/index.js';
import {Container} from 'inversify';
import {RoutingControllersOptions, useContainer} from 'routing-controllers';
import {coursesContainerModule} from './container.js';
import {usersContainerModule} from '#users/container.js';
import {
  CourseController,
  CourseVersionController,
  ItemController,
  ModuleController,
  SectionController,
} from './controllers/index.js';

export async function setupCoursesContainer(): Promise<void> {
  const container = new Container();
  await container.load(
    sharedContainerModule,
    authContainerModule,
    coursesContainerModule,
    usersContainerModule,
  );
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const coursesModuleOptions: RoutingControllersOptions = {
  controllers: [
    CourseController,
    CourseVersionController,
    ModuleController,
    SectionController,
    ItemController,
  ],
  // defaultErrorHandler: true,
  middlewares: [HttpErrorHandler],
  defaultErrorHandler: false,
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};

export * from './classes/index.js';
export * from './controllers/index.js';
export * from './services/index.js';
export * from './utils/index.js';
export * from './container.js';
export * from './types.js';
