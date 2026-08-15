import {ContainerModule} from 'inversify';
import {CertificateService} from './services/CertificateService.js';
import {CERTIFICATE_TYPES} from './types.js';
import {CertificateController} from './controllers/CertificateController.js';
import {CertificateRepository} from './repositories/index.js';

export const certificatesContainerModule = new ContainerModule(options => {
  // Repositories
  options.bind(CERTIFICATE_TYPES.CertificateRepo).to(CertificateRepository).inSingletonScope();

  // Services
  options.bind(CERTIFICATE_TYPES.CertificateService).to(CertificateService).inSingletonScope();

  // Controllers
  options.bind(CertificateController).toSelf().inSingletonScope();
});
