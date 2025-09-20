import {ContainerModule} from 'inversify';
import {PROJECTS_TYPES} from './types.js';
import {ProjectSubmissionRepository} from './repositories/index.js';
import { ProjectController } from './controllers/ProjectController.js';
import { ProjectService } from './services/ProjectService.js';

export const projectsContainerModule = new ContainerModule(options => {
  // Repository
  options
    .bind(PROJECTS_TYPES.projectSubmissionRepository)
    .to(ProjectSubmissionRepository)
    .inSingletonScope();

  // Service
  options
    .bind(PROJECTS_TYPES.ProjectService)
    .to(ProjectService)
    .inSingletonScope();

  // Controller
  options.bind(ProjectController).toSelf().inSingletonScope();
});
