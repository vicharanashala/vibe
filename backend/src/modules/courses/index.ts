import {Action, getFromContainer, useContainer} from 'routing-controllers';
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
import {FirebaseAuthService} from 'modules/auth/services/FirebaseAuthService';
import {UserRepository} from 'shared/database/providers/mongo/repositories/UserRepository';

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

export * from './classes/validators/index';
export * from './classes/transformers/index';
export * from './controllers/index';
