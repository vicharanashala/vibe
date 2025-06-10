import {
  Action,
  getFromContainer,
  useContainer,
  RoutingControllersOptions,
} from 'routing-controllers';
import {HttpErrorHandler} from '#shared/index.js';
import {Container} from 'inversify';
import {sharedContainerModule} from '#root/container.js';
import {authContainerModule} from '#auth/container.js';
import {usersContainerModule} from '#users/container.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {coursesContainerModule} from './container.js';
import {
  CourseController,
  CourseVersionController,
  ModuleController,
  SectionController,
  ItemController,
} from './controllers/index.js';
import {FirebaseAuthService} from '#auth/services/FirebaseAuthService.js';

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
  currentUserChecker: async function (action: Action) {
    // Use the auth service to check if the user is authorized
    const authService =
      getFromContainer<FirebaseAuthService>(FirebaseAuthService);
    const token = action.request.headers['authorization']?.split(' ')[1];
    if (!token) {
      return false;
    }

    try {
      return await authService.verifyToken(token);
    } catch (error) {
      return false;
    }
  },
  validation: true,
};

export * from './classes/index.js';
export * from './controllers/index.js';
export * from './services/index.js';
export * from './utils/index.js';
export * from './container.js';
export * from './types.js';
