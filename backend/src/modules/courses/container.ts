import {ContainerModule} from 'inversify';
import {USERS_TYPES} from './types.js';
import { CourseController } from './controllers/CourseController.js';

export const coursesContainerModule = new ContainerModule(options => {
  // Repositories
  // Services
//   options
//     .bind(USERS_TYPES.UserService)
//     .to(UserService)
//     .inSingletonScope();

  // Controllers
  options.bind(CourseController).toSelf().inSingletonScope();
});
