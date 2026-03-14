import {authContainerModule} from '#auth/container.js';
import {sharedContainerModule} from '#root/container.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {authorizationChecker, HttpErrorHandler} from '#shared/index.js';
import {Container, ContainerModule} from 'inversify';
import {RoutingControllersOptions, useContainer} from 'routing-controllers';
import {ejectionPolicyContainerModule} from './container.js';
import {EjectionPolicyController} from './controllers/index.js';
import {usersContainerModule} from '../users/container.js';
import {EJECTION_POLICY_VALIDATORS} from './classes/validators/index.js';
import {currentUserChecker} from '#root/shared/functions/currentUserChecker.js';

// Container modules that this module depends on
export const ejectionPolicyContainerModules: ContainerModule[] = [
  sharedContainerModule,
  authContainerModule,
  usersContainerModule,
  ejectionPolicyContainerModule,
];

// Controllers exported by this module
export const ejectionPolicyModuleControllers: Function[] = [
  EjectionPolicyController,
];

// Validators exported by this module
export const ejectionPolicyModuleValidators: Function[] = [
  ...EJECTION_POLICY_VALIDATORS,
];

// Setup function for standalone module loading
export async function setupEjectionPolicyContainer(): Promise<void> {
  const container = new Container();
  await container.load(...ejectionPolicyContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

// Module options for routing-controllers (used in tests)
export const ejectionPolicyModuleOptions: RoutingControllersOptions = {
  controllers: ejectionPolicyModuleControllers,
  middlewares: [HttpErrorHandler],
  defaultErrorHandler: false,
  authorizationChecker: authorizationChecker,
  currentUserChecker: currentUserChecker,
  validation: true,
};
