import {dbConfig} from './config/db';
import {ContainerModule} from 'inversify';
import {
  MongoDatabase,
  UserRepository,
  CourseRepository,
} from './shared/database/providers/MongoDatabaseProvider';
import TYPES from './types';
import {appConfig} from 'config/app';
import {OpenApiSpecService} from 'modules/docs';

export const sharedContainerModule = new ContainerModule(options => {
  const uri = dbConfig.url;
  const dbName = dbConfig.dbName || 'vibe';

  options.bind(TYPES.uri).toConstantValue(uri);
  options.bind(TYPES.dbName).toConstantValue(dbName);

  // Database
  options.bind(TYPES.Database).to(MongoDatabase).inSingletonScope();

  // Repositories
  options.bind(TYPES.UserRepository).to(UserRepository).inSingletonScope();
  options.bind(TYPES.CourseRepo).to(CourseRepository).inSingletonScope();

  //Services
  if (!appConfig.isProduction) {
    options.bind(OpenApiSpecService).toSelf().inSingletonScope();
  }
});
