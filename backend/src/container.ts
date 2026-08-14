import { ContainerModule } from 'inversify';
import { GLOBAL_TYPES } from './types.js';
import { dbConfig } from './config/db.js';

export const sharedContainerModule = new ContainerModule(async (options) => {
  const {
    MongoDatabase,
    UserRepository,
    HttpErrorHandler,
    SettingRepository,
  } = await import('#shared/index.js');
  const { AuditTrailsHandler } = await import('./shared/middleware/auditTrails.js');
  const { CourseRepository } = await import('#shared/database/providers/mongo/repositories/CourseRepository.js');
  const { SlotBookingRepository } = await import('#shared/database/providers/mongo/repositories/SlotBookingRepository.js');
  const { FirebaseAuthService } = await import('./modules/auth/services/FirebaseAuthService.js');
  const { ProgressService } = await import('./modules/users/services/ProgressService.js');
  const { EnrollmentService } = await import('./modules/users/services/EnrollmentService.js');
  const { CohortScopeService } = await import('./shared/functions/cohortScope.js');

  const uri = dbConfig.url;
  const dbName = dbConfig.dbName;

  options.bind(GLOBAL_TYPES.uri).toConstantValue(uri);
  options.bind(GLOBAL_TYPES.dbName).toConstantValue(dbName);

  // Auth
  options.bind(FirebaseAuthService).toSelf().inSingletonScope();
  options.bind(ProgressService).toSelf().inSingletonScope();
  options.bind(EnrollmentService).toSelf().inSingletonScope();
  options.bind(CohortScopeService).toSelf().inSingletonScope();

  // Database
  options.bind(GLOBAL_TYPES.Database).to(MongoDatabase).inSingletonScope();

  // Repositories
  options.bind(GLOBAL_TYPES.UserRepo).to(UserRepository).inSingletonScope();
  options.bind(GLOBAL_TYPES.CourseRepo).to(CourseRepository).inSingletonScope();
  options.bind(GLOBAL_TYPES.SettingRepo).to(SettingRepository).inSingletonScope();
  options.bind(GLOBAL_TYPES.SlotBookingRepo).to(SlotBookingRepository).inSingletonScope();

  // Other
  options.bind(HttpErrorHandler).toSelf().inSingletonScope();
  options.bind(AuditTrailsHandler).toSelf().inSingletonScope();
});
