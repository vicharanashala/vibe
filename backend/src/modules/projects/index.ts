import {Container, ContainerModule} from 'inversify';
import {projectsContainerModule} from './container.js';
import {ProjectController} from './controllers/projectController.js';
import {RubricController} from './controllers/rubricController.js';
import {AssessmentController} from './controllers/assessmentController.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {useContainer} from 'class-validator';
import {RoutingControllersOptions} from 'routing-controllers';
import {PROJECT_VALIDATORS} from './classes/validators/ProjectValidators.js';
import {RUBRIC_VALIDATORS} from './classes/validators/RubricValidators.js';

export const projectsContainerModules: ContainerModule[] = [
  projectsContainerModule,
];

export const projectsModuleControllers: Function[] = [
  ProjectController,
  RubricController,
  AssessmentController,
];

export async function setupProjectsContainer(): Promise<void> {
  const container = new Container();
  await container.load(...projectsContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const projectsModuleOptions: RoutingControllersOptions = {
  controllers: projectsModuleControllers,
  middlewares: [],
  defaultErrorHandler: true,
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};

export const projectsModuleValidators: Function[] = [
  ...PROJECT_VALIDATORS,
  ...RUBRIC_VALIDATORS,
];
