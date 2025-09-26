import {Container, ContainerModule} from 'inversify';
import { CourseRegistrationContainerModule } from './container.js';
import { CourseRegistrationController } from './controllers/CourseRegistrationController.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {useContainer} from 'class-validator';
import { RoutingControllersOptions } from 'routing-controllers';
import { authorizationChecker, HttpErrorHandler } from '#root/shared/index.js';
// import { REPORT_VALIDATORS } from './classes/index.js';

export const CourseRegistrationContainerModules: ContainerModule[] = [
  CourseRegistrationContainerModule,
];

export const CourseRegistrationModuleControllers: Function[] = [CourseRegistrationController];

export async function setupReportsContainer(): Promise<void> {
  const container = new Container();
  await container.load(...CourseRegistrationContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}


export const reportsModuleOptions: RoutingControllersOptions = {
  controllers: CourseRegistrationModuleControllers,
  middlewares: [HttpErrorHandler],
  defaultErrorHandler: false,
  authorizationChecker,
  validation: true,
};


// export const reportsModuleValidators: Function[] = [
//   ...REPORT_VALIDATORS
// ]