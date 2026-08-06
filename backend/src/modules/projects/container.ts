import {ContainerModule} from 'inversify';
import {PROJECTS_TYPES} from './types.js';
import {ProjectSubmissionRepository, RubricRepository, AssessmentRepository} from './repositories/index.js';
import {ProjectController} from './controllers/projectController.js';
import {RubricController} from './controllers/rubricController.js';
import {AssessmentController} from './controllers/assessmentController.js';
import {ProjectService} from './services/projectService.js';
import {RubricService} from './services/rubricService.js';
import {AssessmentService} from './services/assessmentService.js';

export const projectsContainerModule = new ContainerModule(options => {
  // Repositories
  options
    .bind(PROJECTS_TYPES.projectSubmissionRepository)
    .to(ProjectSubmissionRepository)
    .inSingletonScope();
  options
    .bind(PROJECTS_TYPES.RubricRepository)
    .to(RubricRepository)
    .inSingletonScope();
  options
    .bind(PROJECTS_TYPES.AssessmentRepository)
    .to(AssessmentRepository)
    .inSingletonScope();

  // Services
  options
    .bind(PROJECTS_TYPES.ProjectService)
    .to(ProjectService)
    .inSingletonScope();
  options
    .bind(PROJECTS_TYPES.RubricService)
    .to(RubricService)
    .inSingletonScope();
  options
    .bind(PROJECTS_TYPES.AssessmentService)
    .to(AssessmentService)
    .inSingletonScope();

  // Controllers
  options.bind(ProjectController).toSelf().inSingletonScope();
  options.bind(RubricController).toSelf().inSingletonScope();
  options.bind(AssessmentController).toSelf().inSingletonScope();
});
