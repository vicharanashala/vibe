import {useContainer} from 'routing-controllers';
import {RoutingControllersOptions} from 'routing-controllers';
import {HttpErrorHandler} from '../../shared/middleware/errorHandler';
import {
  CourseController,
  CourseVersionController,
  ModuleController,
  SectionController,
  ItemController,
} from './controllers';
import {Container} from 'inversify';
import {sharedContainerModule} from '../../container';
import {authContainerModule} from '../auth/container';
import {usersContainerModule} from '../users/container';
import {InversifyAdapter} from '../../inversify-adapter';
import {coursesContainerModule} from './container';

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

export * from './classes/validators/index';
export * from './classes/transformers/index';
export * from './controllers/index';
