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

export const coursesContainerModules: ContainerModule[] = [
    hpSystemContainerModule,
    sharedContainerModule,
    authContainerModule,
    usersContainerModule,
    quizzesContainerModule,
    notificationsContainerModule
];

export const coursesModuleControllers: Function[] = [
    ActivityController,
    ActivitySubmissionsController,
    LedgerController,
    RuleConfigsController,
];

export async function setupCoursesContainer(): Promise<void> {
    const container = new Container();
    await container.load(...coursesContainerModules);
    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);
}

export const coursesModuleOptions: RoutingControllersOptions = {
    controllers: coursesModuleControllers,
    middlewares: [HttpErrorHandler],
    defaultErrorHandler: false,
    authorizationChecker: authorizationChecker,
    validation: true,
};

// export const coursesModuleValidators: Function[] = [
//     ...COURSE_VALIDATORS,
//     ...COURSEVERSION_VALIDATORS,
//     ...ITEM_VALIDATORS,
//     ...MODULE_VALIDATORS,
//     ...SECTION_VALIDATORS
// ]