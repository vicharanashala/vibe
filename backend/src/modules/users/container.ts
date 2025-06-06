import {ContainerModule} from 'inversify';
import TYPES from './types';

import {EnrollmentService, ProgressService} from './services';
import {
  ProgressController,
  EnrollmentController,
  UserController,
} from './controllers';

import {EnrollmentRepository} from 'shared/database/providers/mongo/repositories/EnrollmentRepository';
import {ProgressRepository} from 'shared/database/providers/mongo/repositories/ProgressRepository';
import {UserRepository} from 'shared/database/providers/mongo/repositories/UserRepository';

export const usersContainerModule = new ContainerModule(options => {
  // Repositories
  options.bind(TYPES.ProgressRepo).to(ProgressRepository).inSingletonScope();
  options
    .bind(TYPES.EnrollmentRepo)
    .to(EnrollmentRepository)
    .inSingletonScope();
  options.bind(TYPES.UserRepo).to(UserRepository).inSingletonScope();

  // Services
  options
    .bind(TYPES.EnrollmentService)
    .to(EnrollmentService)
    .inSingletonScope();
  options.bind(TYPES.ProgressService).to(ProgressService).inSingletonScope();

  // Controllers
  options.bind(ProgressController).toSelf().inSingletonScope();
  options.bind(EnrollmentController).toSelf().inSingletonScope();
  options.bind(UserController).toSelf().inSingletonScope();
});
