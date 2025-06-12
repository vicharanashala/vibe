import {appConfig} from '#config/app.js';
import {dbConfig} from '#config/db.js';
import {OpenApiSpecService} from '#docs/index.js';
import {ContainerModule} from 'inversify';
import {
  MongoDatabase,
  CourseRepository,
  UserRepository,
  HttpErrorHandler,
} from '#shared/index.js';
import {GLOBAL_TYPES} from './types.js';

export const sharedContainerModule = new ContainerModule(options => {
  const uri = dbConfig.url;
  const dbName = dbConfig.dbName || 'vibe';

  options.bind(GLOBAL_TYPES.uri).toConstantValue(uri);
  options.bind(GLOBAL_TYPES.dbName).toConstantValue(dbName);

  // Database
  options.bind(GLOBAL_TYPES.Database).to(MongoDatabase).inSingletonScope();

  // Repositories
  options.bind(GLOBAL_TYPES.UserRepo).to(UserRepository).inSingletonScope();
  options.bind(GLOBAL_TYPES.CourseRepo).to(CourseRepository).inSingletonScope();

  // Services
  if (!appConfig.isProduction) {
    options.bind(OpenApiSpecService).toSelf().inSingletonScope();
  }

  // Other
  options.bind(HttpErrorHandler).toSelf().inSingletonScope();
});
