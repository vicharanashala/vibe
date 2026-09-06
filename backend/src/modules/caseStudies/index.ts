import {Container, ContainerModule} from 'inversify';
import {RoutingControllersOptions, useContainer} from 'routing-controllers';
import {sharedContainerModule} from '#root/container.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {authContainerModule} from '../auth/container.js';
import {settingContainerModule} from '../setting/container.js';
import {notificationsContainerModule} from '../notifications/container.js';
import {caseStudiesContainerModule} from './container.js';
import {CaseStudyController} from './controllers/CaseStudyController.js';
import {
  CaseStudyCoursePathParams,
  CaseStudyIdPathParams,
  ComparisonIdPathParams,
  CreateCaseStudyBody,
  SubmitCaseResponseBody,
  SubmitPickBody,
  UpdateCaseStudyBody,
} from './classes/validators/CaseStudyValidators.js';

export const caseStudiesContainerModules: ContainerModule[] = [
  caseStudiesContainerModule,
  sharedContainerModule,
  authContainerModule,
  // CaseStudyService reads CourseSetting (caseStudiesEnabled/unlock mode/weak
  // streak threshold) and emits NotificationService notifications.
  settingContainerModule,
  notificationsContainerModule,
];

export const caseStudiesModuleControllers: Function[] = [CaseStudyController];

export async function setupCaseStudiesContainer(): Promise<void> {
  const container = new Container();
  await container.load(...caseStudiesContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const caseStudiesModuleOptions: RoutingControllersOptions = {
  controllers: caseStudiesModuleControllers,
  middlewares: [],
  defaultErrorHandler: true,
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};

export const caseStudiesModuleValidators: Function[] = [
  CaseStudyCoursePathParams,
  CaseStudyIdPathParams,
  ComparisonIdPathParams,
  CreateCaseStudyBody,
  SubmitCaseResponseBody,
  SubmitPickBody,
  UpdateCaseStudyBody,
];

export * from './classes/index.js';
export * from './controllers/index.js';
export * from './services/index.js';
export * from './repositories/index.js';
export * from './types.js';
export * from './container.js';
export * from './constants.js';
