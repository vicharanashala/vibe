import {Container, ContainerModule} from 'inversify';
import {reportsContainerModule} from './container.js';
import {ReportController} from './controllers/ReportController.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {useContainer} from 'class-validator';
import { RoutingControllersOptions } from 'routing-controllers';
import { authorizationChecker, HttpErrorHandler } from '#root/shared/index.js';
import { REPORT_VALIDATORS } from './classes/index.js';

export const reportsContainerModules: ContainerModule[] = [
  reportsContainerModule,
];

export const reportsModuleControllers: Function[] = [ReportController];

export async function setupCoursesContainer(): Promise<void> {
  const container = new Container();
  await container.load(...reportsContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}


export const reportsModuleOptions: RoutingControllersOptions = {
  controllers: reportsModuleControllers,
  middlewares: [HttpErrorHandler],
  defaultErrorHandler: false,
  authorizationChecker,
  validation: true,
};


export const reportsModuleValidators: Function[] = [
  ...REPORT_VALIDATORS
]