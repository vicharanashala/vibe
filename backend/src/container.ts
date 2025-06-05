import {dbConfig} from './config/db.js';
import {ContainerModule} from 'inversify';
import {
  MongoDatabase,
  UserRepository,
  CourseRepository,
} from './shared/database/providers/index.js';
import TYPES from './types.js';
import {appConfig} from '#root/config/app.js';
import {OpenApiSpecService} from '#root/modules/docs/index.js';
import {HttpErrorHandler} from './shared/middleware/errorHandler.js';

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

  // Services
  if (!appConfig.isProduction) {
    options.bind(OpenApiSpecService).toSelf().inSingletonScope();
  }

  // Other
  options.bind(HttpErrorHandler).toSelf().inSingletonScope();
});
