import {Container, ContainerModule} from 'inversify';
import {certificatesContainerModule} from './container.js';
import {CertificateController} from './controllers/CertificateController.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {useContainer} from 'class-validator';
import {RoutingControllersOptions} from 'routing-controllers';
import {authorizationChecker, HttpErrorHandler} from '#root/shared/index.js';
import {CERTIFICATE_VALIDATORS} from './classes/index.js';

// NOTE: these export names are load-bearing. bootstrap/loadModules.ts reads
// `${folderName}ModuleControllers`, `${folderName}ModuleValidators`, and
// `${folderName}ContainerModules` by string interpolation off this folder's
// name ("certificates"), so renaming the folder means renaming these too.

export const certificatesContainerModules: ContainerModule[] = [
  certificatesContainerModule,
];

export const certificatesModuleControllers: Function[] = [CertificateController];

export async function setupCertificatesContainer(): Promise<void> {
  const container = new Container();
  await container.load(...certificatesContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const certificatesModuleOptions: RoutingControllersOptions = {
  controllers: certificatesModuleControllers,
  middlewares: [HttpErrorHandler],
  defaultErrorHandler: false,
  authorizationChecker,
  validation: true,
};

export const certificatesModuleValidators: Function[] = [
  ...CERTIFICATE_VALIDATORS,
];
