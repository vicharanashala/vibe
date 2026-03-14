import {ContainerModule} from 'inversify';
import {EJECTION_POLICY_TYPES} from './types.js';
import {EjectionPolicyService} from './services/EjectionPolicyService.js';
import {EjectionPolicyRepository} from './repositories/providers/mongodb/EjectionPolicyRepository.js';
import {EjectionPolicyController} from './controllers/EjectionPolicyController.js';

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
});
