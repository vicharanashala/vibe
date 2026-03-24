import {ContainerModule} from 'inversify';
import {EJECTION_POLICY_TYPES} from './types.js';
import {EjectionPolicyService} from './services/EjectionPolicyService.js';
import {EjectionPolicyRepository} from './repositories/providers/mongodb/EjectionPolicyRepository.js';
import {EjectionPolicyController} from './controllers/EjectionPolicyController.js';
import {ManualEjectionService} from './services/ManualEjectionService.js';
import {ManualEjectionController} from './controllers/ManualEjectionController.js';
import {ReinstatementService} from './services/ReinstatementService.js';
import {ReinstatementController} from './controllers/ReinstatementController.js';
import {AutoEjectionEngine} from './services/AutoEjectionEngine.js';
import {AutoEjectionController} from './controllers/AutoEjectionController.js';
import {AppealRepository} from '#root/shared/database/providers/mongo/repositories/AppealRepository.js';
import {AppealService} from './services/AppealService.js';
import {AppealController} from './controllers/AppealController.js';
export const ejectionPolicyContainerModule = new ContainerModule(options => {
  // Repositories
  options
    .bind(EJECTION_POLICY_TYPES.EjectionPolicyRepo)
    .to(EjectionPolicyRepository)
    .inSingletonScope();

  // Services
  options
    .bind(EJECTION_POLICY_TYPES.EjectionPolicyService)
    .to(EjectionPolicyService)
    .inSingletonScope();

  // Controllers
  options.bind(EjectionPolicyController).toSelf().inSingletonScope();

  options
    .bind(EJECTION_POLICY_TYPES.ManualEjectionService)
    .to(ManualEjectionService)
    .inSingletonScope();

  options.bind(ManualEjectionController).toSelf().inSingletonScope();

  options
    .bind(EJECTION_POLICY_TYPES.ReinstatementService)
    .to(ReinstatementService)
    .inSingletonScope();

  options.bind(ReinstatementController).toSelf().inSingletonScope();
  options.bind(AutoEjectionController).toSelf().inSingletonScope();
  options.bind(AppealController).toSelf().inSingletonScope();
  options
    .bind(EJECTION_POLICY_TYPES.AutoEjectionEngine)
    .to(AutoEjectionEngine)
    .inSingletonScope();

  options
    .bind(EJECTION_POLICY_TYPES.AppealRepo)
    .to(AppealRepository)
    .inSingletonScope();
  options
    .bind(EJECTION_POLICY_TYPES.AppealService)
    .to(AppealService)
    .inSingletonScope();
});
