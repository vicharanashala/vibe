import {useContainer} from 'routing-controllers';
import {RoutingControllersOptions} from 'routing-controllers';
import {HttpErrorHandler} from '../../shared/middleware/errorHandler.js';
import {
  CourseController,
  CourseVersionController,
  ModuleController,
  SectionController,
  ItemController,
} from './controllers/index.js';
import {Container} from 'inversify';
import {sharedContainerModule} from '../../container.js';
import {authContainerModule} from '../auth/container.js';
import {InversifyAdapter} from '../../inversify-adapter.js';
import {coursesContainerModule} from './container.js';

export async function setupCoursesContainer(): Promise<void> {
  const container = new Container();
  await container.load(
    sharedContainerModule,
    authContainerModule,
    coursesContainerModule,
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

export * from './classes/validators/index.js';
export * from './classes/transformers/index.js';
export * from './controllers/index.js';
