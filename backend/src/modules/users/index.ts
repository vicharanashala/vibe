import {
  ExpressErrorMiddlewareInterface,
  HttpError,
  Middleware,
  useContainer,
} from 'routing-controllers';
import {RoutingControllersOptions} from 'routing-controllers';
import {Container, Service} from 'typedi';
import {MongoDatabase} from 'shared/database/providers/mongo/MongoDatabase';
import {EnrollmentRepository} from 'shared/database/providers/mongo/repositories/EnrollmentRepository';
import {CourseRepository} from 'shared/database/providers/mongo/repositories/CourseRepository';
import {EnrollmentController} from './controllers/EnrollmentController';
import {EnrollmentService} from './services';
import {UserRepository} from 'shared/database/providers/MongoDatabaseProvider';
import {dbConfig} from '../../config/db';
import {ProgressRepository} from 'shared/database/providers/mongo/repositories/ProgressRepository';
import {ProgressController} from './controllers/index';
import {ProgressService} from './services/ProgressService';
import {Course} from 'modules/courses';
useContainer(Container);

export function setupUsersModuleDependencies(): void {
  if (!Container.has('Database')) {
    Container.set('Database', new MongoDatabase(dbConfig.url, 'vibe'));
  }

  if (!Container.has('EnrollmentRepo')) {
    Container.set(
      'EnrollmentRepo',
      new EnrollmentRepository(Container.get<MongoDatabase>('Database')),
    );
  }

  if (!Container.has('ProgressRepo')) {
    Container.set(
      'ProgressRepo',
      new ProgressRepository(Container.get<MongoDatabase>('Database')),
    );
  }

  if (!Container.has('CourseRepo')) {
    Container.set(
      'CourseRepo',
      new CourseRepository(Container.get<MongoDatabase>('Database')),
    );
  }

  if (!Container.has('UserRepo')) {
    Container.set(
      'UserRepo',
      new UserRepository(Container.get<MongoDatabase>('Database')),
    );
  }

  if (!Container.has('EnrollmentService')) {
    Container.set(
      'EnrollmentService',
      new EnrollmentService(
        Container.get<EnrollmentRepository>('EnrollmentRepo'),
        Container.get<CourseRepository>('CourseRepo'),
        Container.get<UserRepository>('UserRepo'),
      ),
    );
  }

  if (!Container.has('ProgressService')) {
    Container.set(
      'ProgressService',
      new ProgressService(
        Container.get<ProgressRepository>('ProgressRepo'),
        Container.get<CourseRepository>('CourseRepo'),
        Container.get<UserRepository>('UserRepo'),
      ),
    );
  }
}

setupUsersModuleDependencies();

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
