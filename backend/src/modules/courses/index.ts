import {useContainer} from 'routing-controllers';
import {RoutingControllersOptions} from 'routing-controllers';
import {IDatabase} from 'shared/database';
import {Container} from 'typedi';
import {MongoDatabase} from 'shared/database/providers/mongo/MongoDatabase';
import {dbConfig} from '../../config/db';
import {CourseController} from './controllers/CourseController';
import {CourseRepository} from 'shared/database/providers/mongo/repositories/CourseRepository';
import {CourseVersionController} from './controllers/CourseVersionController';
import {ModuleController} from './controllers/ModuleController';
import {SectionController} from './controllers/SectionController';
import {ItemController} from './controllers/ItemController';

useContainer(Container);

export function setupCoursesModuleDependencies() {
  if (!Container.has('Database')) {
    Container.set<IDatabase>(
      'Database',
      new MongoDatabase(dbConfig.url, 'vibe'),
    );
  }

  if (!Container.has('CourseRepo')) {
    Container.set(
      'CourseRepo',
      new CourseRepository(Container.get<MongoDatabase>('Database')),
    );
  }
}

setupCoursesModuleDependencies();

export const coursesModuleOptions: RoutingControllersOptions = {
  controllers: [
    CourseController,
    CourseVersionController,
    ModuleController,
    SectionController,
    ItemController,
  ],
  defaultErrorHandler: true,
  // middlewares: [HttpErrorHandler],
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};

export * from './classes/validators/index';
export * from './classes/transformers/index';
export * from './controllers/index';
