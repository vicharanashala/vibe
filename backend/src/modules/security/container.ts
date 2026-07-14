import { ContainerModule } from 'inversify';
import { SECURITY_TYPES } from './types.js';
import { SecurityService } from './services/SecurityService.js';
import { SessionRiskRepository } from './repositories/index.js';

export const securityContainerModule = new ContainerModule((bind) => {
  bind(SECURITY_TYPES.SecurityService).to(SecurityService).inSingletonScope();
  bind(SECURITY_TYPES.SessionRiskRepository).to(SessionRiskRepository).inSingletonScope();
});
