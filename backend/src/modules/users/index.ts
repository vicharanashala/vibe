import {authContainerModule} from '#auth/container.js';
import {sharedContainerModule} from '#root/container.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {Container, ContainerModule} from 'inversify';
import {RoutingControllersOptions, useContainer} from 'routing-controllers';
import {usersContainerModule} from './container.js';
import {EnrollmentController} from './controllers/EnrollmentController.js';
import {ProgressController} from './controllers/ProgressController.js';
import {UserController} from './controllers/UserController.js';
import { CourseController } from '../courses/controllers/CourseController.js';
import { coursesContainerModule } from '../courses/container.js';


export const usersContainerModules: ContainerModule[] = [
  usersContainerModule,
  sharedContainerModule,
  authContainerModule,
  coursesContainerModule,
];

export const usersModuleControllers: Function[] = [
  EnrollmentController,
  ProgressController,
  UserController,
  CourseController,
];

export async function setupUsersContainer(): Promise<void> {
  const container = new Container();
  await container.load(...usersContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const usersModuleOptions: RoutingControllersOptions = {
  controllers: usersModuleControllers,
  middlewares: [],
  defaultErrorHandler: true,
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};
