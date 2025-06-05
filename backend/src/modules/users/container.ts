import {ContainerModule} from 'inversify';
import TYPES from './types.js';

import {EnrollmentService, ProgressService} from './services/index.js';
import {ProgressController, EnrollmentController} from './controllers/index.js';

import {EnrollmentRepository} from '#root/shared/database/providers/mongo/repositories/EnrollmentRepository.js';
import {ProgressRepository} from '#root/shared/database/providers/mongo/repositories/ProgressRepository.js';

export const usersContainerModule = new ContainerModule(options => {
  // Repositories
  options.bind(TYPES.ProgressRepo).to(ProgressRepository).inSingletonScope();
  options
    .bind(TYPES.EnrollmentRepo)
    .to(EnrollmentRepository)
    .inSingletonScope();

  // Services
  options
    .bind(TYPES.EnrollmentService)
    .to(EnrollmentService)
    .inSingletonScope();
  options.bind(TYPES.ProgressService).to(ProgressService).inSingletonScope();

  // Controllers
  options.bind(ProgressController).toSelf().inSingletonScope();
  options.bind(EnrollmentController).toSelf().inSingletonScope();
});
