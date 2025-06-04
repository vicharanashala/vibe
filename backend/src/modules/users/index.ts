import {
  ExpressErrorMiddlewareInterface,
  HttpError,
  Middleware,
  useContainer,
} from 'routing-controllers';
import {RoutingControllersOptions} from 'routing-controllers';
import {MongoDatabase} from '../../shared/database/providers/mongo/MongoDatabase';
import {EnrollmentRepository} from '../../shared/database/providers/mongo/repositories/EnrollmentRepository';
import {CourseRepository} from '../../shared/database/providers/mongo/repositories/CourseRepository';
import {ItemRepository} from '../../shared/database/providers/mongo/repositories/ItemRepository';
import {EnrollmentController} from './controllers/EnrollmentController';
import {EnrollmentService} from './services';
import {UserRepository} from '../../shared/database/providers/MongoDatabaseProvider';
import {dbConfig} from '../../config/db';
import {ProgressRepository} from '../../shared/database/providers/mongo/repositories/ProgressRepository';
import {ProgressController} from './controllers/index';
import {ProgressService} from './services/ProgressService';
import {Course} from '../../modules/courses';
import {sharedContainerModule} from '../../container';
import {authContainerModule} from '../auth/container';
import {usersContainerModule} from './container';
import {Container} from 'inversify';
import {InversifyAdapter} from '../../inversify-adapter';

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

export * from './classes/validators/index';
export * from './classes/transformers/index';
export * from './controllers/index';

export {EnrollmentController};
