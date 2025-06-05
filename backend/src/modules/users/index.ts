import {
  ExpressErrorMiddlewareInterface,
  HttpError,
  Middleware,
  useContainer,
} from 'routing-controllers';
import {RoutingControllersOptions} from 'routing-controllers';
import {MongoDatabase} from '../../shared/database/providers/mongo/MongoDatabase.js';
import {EnrollmentRepository} from '../../shared/database/providers/mongo/repositories/EnrollmentRepository.js';
import {CourseRepository} from '../../shared/database/providers/mongo/repositories/CourseRepository.js';
import {ItemRepository} from '../../shared/database/providers/mongo/repositories/ItemRepository.js';
import {EnrollmentController} from './controllers/EnrollmentController.js';
import {EnrollmentService} from './services/index.js';
import {UserRepository} from '../../shared/database/providers/index.js';
import {dbConfig} from '../../config/db.js';
import {ProgressRepository} from '../../shared/database/providers/mongo/repositories/ProgressRepository.js';
import {ProgressController} from './controllers/index.js';
import {ProgressService} from './services/ProgressService.js';
import {Course} from '../../modules/courses/index.js';
import {sharedContainerModule} from '../../container.js';
import {authContainerModule} from '../auth/container.js';
import {usersContainerModule} from './container.js';
import {Container} from 'inversify';
import {InversifyAdapter} from '../../inversify-adapter.js';

export async function setupUsersContainer(): Promise<void> {
  const container = new Container();
  await container.load(
    sharedContainerModule,
    authContainerModule,
    usersContainerModule,
  );
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const usersModuleOptions: RoutingControllersOptions = {
  controllers: [EnrollmentController, ProgressController],
  middlewares: [],
  defaultErrorHandler: true,
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};

export * from './classes/index.js';
export * from './controllers/index.js';
export * from './services/index.js';
export * from './types.js';
export * from './container.js';

export {EnrollmentController};
