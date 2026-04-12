import { Container, ContainerModule } from 'inversify';
import { sharedContainerModule } from '#root/container.js';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import {
    RoutingControllersOptions,
    useContainer,
} from 'routing-controllers';
import { AnnouncementController } from './controllers/AnnouncementController.js';
import { announcementsContainerModule } from './container.js';
import { usersContainerModule } from '#root/modules/users/container.js';

export const announcementsModuleControllers: Function[] = [
    AnnouncementController,
];

export const announcementsContainerModules: ContainerModule[] = [
    announcementsContainerModule,
    sharedContainerModule,
    usersContainerModule,
];

export async function setupAnnouncementsContainer(): Promise<void> {
    const container = new Container();
    await container.load(...announcementsContainerModules);
    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);
}

export const announcementsModuleOptions: RoutingControllersOptions = {
    controllers: [AnnouncementController],
    middlewares: [],
    defaultErrorHandler: true,
    authorizationChecker: async function () {
        return true;
    },
    validation: true,
};

export * from './classes/index.js';
export * from './controllers/index.js';
export * from './services/index.js';
export * from './abilities/index.js';
export * from './container.js';
