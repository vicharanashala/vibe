import {dbConfig} from './config/db';
import {ContainerModule} from 'inversify';
import {MongoDatabase} from './shared/database/providers/MongoDatabaseProvider';
import TYPES from './types';

export const sharedContainerModule = new ContainerModule(options => {
  const uri = dbConfig.url;
  const dbName = dbConfig.dbName || 'vibe';

  options.bind(TYPES.uri).toConstantValue(uri);
  options.bind(TYPES.dbName).toConstantValue(dbName);

  // Database
  options.bind(TYPES.Database).to(MongoDatabase).inSingletonScope();
});
