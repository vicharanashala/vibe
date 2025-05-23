import {useContainer} from 'routing-controllers';
import {RoutingControllersOptions} from 'routing-controllers';
import {IDatabase} from 'shared/database';
import {Container} from 'typedi';
import {MongoDatabase} from 'shared/database/providers/mongo/MongoDatabase';
import {dbConfig} from '../../config/db';
import {CourseController} from './controllers/CourseController';
import {CourseRepository} from 'shared/database/providers/mongo/repositories/CourseRepository';
import {ItemRepository} from 'shared/database/providers/mongo/repositories/ItemRepository';
import {CourseVersionController} from './controllers/CourseVersionController';
import {ModuleController} from './controllers/ModuleController';
import {SectionController} from './controllers/SectionController';
import {ItemController} from './controllers/ItemController';
import {
  CourseService,
  CourseVersionService,
  ModuleService,
  SectionService,
} from './services';
import {ItemService} from './services';
import {HttpErrorHandler} from 'shared/middleware/errorHandler';

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

  if (!Container.has('CourseService')) {
    Container.set(
      'CourseService',
      new CourseService(Container.get<CourseRepository>('CourseRepo')),
    );
  }

  if (!Container.has('ItemRepo')) {
    Container.set(
      'ItemRepo',
      new ItemRepository(
        Container.get<MongoDatabase>('Database'),
        Container.get<CourseRepository>('CourseRepo'),
      ),
    );
  }

  if (!Container.has('ItemService')) {
    Container.set(
      'ItemService',
      new ItemService(
        Container.get<ItemRepository>('ItemRepo'),
        Container.get<CourseRepository>('CourseRepo'),
      ),
    );
  }
  if (!Container.has('CourseVersionService')) {
    Container.set(
      'CourseVersionService',
      new CourseVersionService(Container.get<CourseRepository>('CourseRepo')),
    );
  }
  if (!Container.has('SectionService')) {
    Container.set(
      'SectionService',
      new SectionService(
        Container.get<ItemRepository>('ItemRepo'),
        Container.get<CourseRepository>('CourseRepo'),
      ),
    );
  }
  if (!Container.has('ModuleService')) {
    Container.set(
      'ModuleService',
      new ModuleService(Container.get<CourseRepository>('CourseRepo')),
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
  // defaultErrorHandler: true,
  middlewares: [HttpErrorHandler],
  defaultErrorHandler: false,
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};

export * from './classes/validators/index';
export * from './classes/transformers/index';
export * from './controllers/index';
