import {Container, ContainerModule} from 'inversify';
import { courseRegistrationContainerModule } from './container.js';
import { CourseRegistrationController } from './controllers/CourseRegistrationController.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {useContainer} from 'class-validator';
import { RoutingControllersOptions } from 'routing-controllers';
import { authorizationChecker, HttpErrorHandler } from '#root/shared/index.js';
// import { REPORT_VALIDATORS } from './classes/index.js';

export const courseRegistrationContainerModules: ContainerModule[] = [
  courseRegistrationContainerModule,
];

export const courseRegistrationModuleControllers: Function[] = [CourseRegistrationController];

export async function setupCourseRegistrationContainer(): Promise<void> {
  const container = new Container();
  await container.load(...courseRegistrationContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}


export const courseRegistrationModuleOptions: RoutingControllersOptions = {
  controllers: courseRegistrationModuleControllers,
  middlewares: [HttpErrorHandler],
  defaultErrorHandler: false,
  authorizationChecker,
  validation: true,
};


// export const reportsModuleValidators: Function[] = [
//   ...REPORT_VALIDATORS
// ]