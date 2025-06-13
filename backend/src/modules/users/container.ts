import {
  EnrollmentRepository,
  ProgressRepository,
} from '#shared/database/index.js';
import {ContainerModule} from 'inversify';
import {
  EnrollmentController,
  ProgressController,
  UserController,
} from './controllers/index.js';
import {EnrollmentService, ProgressService} from './services/index.js';
import {USERS_TYPES} from './types.js';
import {AnomalyService} from './services/AnomalyService.js';
import {AnamolyController} from './controllers/AnamolyController.js';

export const usersContainerModule = new ContainerModule(options => {
  // Repositories
  options
    .bind(USERS_TYPES.ProgressRepo)
    .to(ProgressRepository)
    .inSingletonScope();
  options
    .bind(USERS_TYPES.EnrollmentRepo)
    .to(EnrollmentRepository)
    .inSingletonScope();

  // Services
  options
    .bind(USERS_TYPES.EnrollmentService)
    .to(EnrollmentService)
    .inSingletonScope();
  options
    .bind(USERS_TYPES.ProgressService)
    .to(ProgressService)
    .inSingletonScope();
  options
    .bind(USERS_TYPES.AnamolyService)
    .to(AnomalyService)
    .inSingletonScope();

  // Controllers
  options.bind(ProgressController).toSelf().inSingletonScope();
  options.bind(EnrollmentController).toSelf().inSingletonScope();
  options.bind(UserController).toSelf().inSingletonScope();
  options.bind(AnamolyController).toSelf().inSingletonScope();
});
