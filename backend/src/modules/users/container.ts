import {ContainerModule} from 'inversify';
import {USERS_TYPES} from './types.js';
import {UserController} from './controllers/UserController.js';
import {UserService} from './services/UserService.js';
import { EnrollmentService } from './services/EnrollmentService.js';
import { EnrollmentRepository } from '#root/shared/index.js';

export const usersContainerModule = new ContainerModule(options => {
  // Repositories
  options.bind(USERS_TYPES.EnrollmentRepo).to(EnrollmentRepository).inSingletonScope()
  // Services
  options
    .bind(USERS_TYPES.UserService)
    .to(UserService)
    .inSingletonScope();
options
.bind(USERS_TYPES.EnrollmentService).to(EnrollmentService).inSingletonScope()
  // Controllers
  options.bind(UserController).toSelf().inSingletonScope();
});
