import { authContainerModule } from '#auth/container.js';
import { sharedContainerModule } from '#root/container.js';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { authorizationChecker, HttpErrorHandler } from '#shared/index.js';
import { Container, ContainerModule } from 'inversify';
import { RoutingControllersOptions, useContainer } from 'routing-controllers';
import { usersContainerModule } from '../users/container.js';
import { quizzesContainerModule } from '../quizzes/container.js';
import { notificationsContainerModule } from '../notifications/container.js';
import { hpSystemContainerModule } from './container.js';
import { ActivityController } from './controllers/activityController.js';
import { ActivitySubmissionsController } from './controllers/activitySubmissionsController.js';
import { LedgerController } from './controllers/ledgerController.js';
import { RuleConfigsController } from './controllers/ruleConfigsController.js';
import { CohortsController } from './controllers/cohortsController.js';

export const hpSystemContainerModules: ContainerModule[] = [
    hpSystemContainerModule,
    sharedContainerModule,
    authContainerModule,
    usersContainerModule,
    quizzesContainerModule,
    notificationsContainerModule
];

export const hpSystemModuleControllers: Function[] = [
    CohortsController,
    ActivityController,
    ActivitySubmissionsController,
    LedgerController,
    RuleConfigsController,
];

export async function setupHpSystemContainer(): Promise<void> {
    const container = new Container();
    await container.load(...hpSystemContainerModules);
    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);
}

export const coursesModuleOptions: RoutingControllersOptions = {
    controllers: hpSystemModuleControllers,
    middlewares: [HttpErrorHandler],
    defaultErrorHandler: false,
    authorizationChecker: authorizationChecker,
    validation: true,
};
