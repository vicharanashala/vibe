import {
  EnrollmentRepository,
  ProgressRepository,
} from '#shared/database/index.js';
import {ContainerModule} from 'inversify';
import {EnrollmentController, ProgressController} from './controllers/index.js';
import {EnrollmentService, ProgressService} from './services/index.js';
import {USERS_TYPES} from './types.js';

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

  // Controllers
  options.bind(ProgressController).toSelf().inSingletonScope();
  options.bind(EnrollmentController).toSelf().inSingletonScope();
});
