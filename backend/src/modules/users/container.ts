import {ContainerModule} from 'inversify';
import {USERS_TYPES} from './types.js';
import {UserController} from './controllers/UserController.js';
import {UserService} from './services/UserService.js';

export const usersContainerModule = new ContainerModule(options => {
  // Repositories
  // Services
  options
    .bind(USERS_TYPES.UserService)
    .to(UserService)
    .inSingletonScope();

  // Controllers
  options.bind(UserController).toSelf().inSingletonScope();
});
