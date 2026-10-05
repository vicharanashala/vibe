import { ContainerModule } from 'inversify';
import { RoutingControllersOptions } from 'routing-controllers';
import { motivationContainerModule } from './container.js';
import { MotivationController } from './controllers/MotivationController.js';
import { sharedContainerModule } from '#root/container.js';
import { authContainerModule } from '../auth/container.js';
import { usersContainerModule } from '../users/container.js';
import { spacedRepetitionContainerModule } from '../spacedRepetition/container.js';

/**
 * Container modules needed by the motivation module.
 *
 * We include spacedRepetitionContainerModule because the motivation
 * controller injects SPACED_REPETITION_TYPES.ReviewItemRepo. Without
 * this, the @inject() lookup will fail at request time.
 */
export const motivationContainerModules: ContainerModule[] = [
  motivationContainerModule,
  sharedContainerModule,
  authContainerModule,
  usersContainerModule,
  spacedRepetitionContainerModule,
];

export const motivationModuleControllers: Function[] = [
  MotivationController,
];

/**
 * Routing-controllers options for the motivation module.
 *
 * `authorizationChecker: () => true` matches the spaced-repetition
 * pattern — auth is enforced per-endpoint via `@Authorized()` and
 * the per-controller `_assertCanActOnStudent` / `_assertAdmin`
 * helpers, not via a global RBAC role check.
 */
export const motivationModuleOptions: RoutingControllersOptions = {
  controllers: motivationModuleControllers,
  middlewares: [],
  defaultErrorHandler: true,
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};

// No validator classes to export — request validation is handled by
// class-validator decorators on the body/param classes, which are
// discovered automatically via the `validation: true` option above.
export const motivationModuleValidators: Function[] = [];
