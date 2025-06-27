import {authContainerModule} from '#auth/container.js';
import {sharedContainerModule} from '#root/container.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {HttpErrorHandler} from '#shared/index.js';
import {Container, ContainerModule} from 'inversify';
import {RoutingControllersOptions, useContainer} from 'routing-controllers';
import {coursesContainerModule} from './container.js';
import {
  CourseController,
  CourseVersionController,
  ItemController,
  ModuleController,
  SectionController,
} from './controllers/index.js';
import { usersContainerModule } from '../users/container.js';
import { quizzesContainerModule } from '../quizzes/container.js';
import { COURSE_VALIDATORS, COURSEVERSION_VALIDATORS, ITEM_VALIDATORS, MODULE_VALIDATORS, SECTION_VALIDATORS } from './classes/validators/index.js';
import { notificationsContainerModule } from '../notifications/container.js';

export const coursesContainerModules: ContainerModule[] = [
  coursesContainerModule,
  sharedContainerModule,
  authContainerModule,
  usersContainerModule,
  quizzesContainerModule,
  notificationsContainerModule
];

export const coursesModuleControllers: Function[] = [
  CourseController,
  CourseVersionController,
  ModuleController,
  SectionController,
  ItemController,
];

export async function setupCoursesContainer(): Promise<void> {
  const container = new Container();
  await container.load(...coursesContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const coursesModuleOptions: RoutingControllersOptions = {
  controllers: coursesModuleControllers,
  middlewares: [HttpErrorHandler],
  defaultErrorHandler: false,
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};

export const coursesModuleValidators: Function[] = [
  ...COURSE_VALIDATORS,
  ...COURSEVERSION_VALIDATORS,
  ...ITEM_VALIDATORS,
  ...MODULE_VALIDATORS,
  ...SECTION_VALIDATORS
]