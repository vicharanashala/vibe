import {authContainerModule} from '#auth/container.js';
import {sharedContainerModule} from '#root/container.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {Container, ContainerModule} from 'inversify';
import {RoutingControllersOptions, useContainer} from 'routing-controllers';
import { coursesContainerModule } from './container.js';
import { CourseController } from './controllers/CourseController.js';
import { COURSE_VALIDATORS } from './classes/validators/courseValidator.js';
import { COURSEVERSION_VALIDATORS } from './classes/validators/courseVersionValidator.js';
import { CourseVersionController } from './controllers/courseVersionController.js';
// import {UserController} from './controllers/UserController.js';
// import { USER_VALIDATORS } from './classes/validators/index.js';


export const coursesContainerModules: ContainerModule[] = [
  coursesContainerModule,
  sharedContainerModule,
  authContainerModule,
];

export const coursesModuleControllers: Function[] = [
  CourseController,
  CourseVersionController
];

export async function setupUsersContainer(): Promise<void> {
  const container = new Container();
  await container.load(...coursesContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const coursesModuleOptions: RoutingControllersOptions = {
  controllers: coursesModuleControllers,
  middlewares: [],
  defaultErrorHandler: true,
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};

export const coursesModuleValidators: Function[] = [
//   ...USER_VALIDATORS
...COURSE_VALIDATORS,
...COURSEVERSION_VALIDATORS
]