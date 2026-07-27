import { Container, ContainerModule } from 'inversify';
import { sharedContainerModule } from '#root/container.js';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import {
    RoutingControllersOptions,
    useContainer,
} from 'routing-controllers';
import { DiscussionController } from './controllers/DiscussionController.js';

export const discussionsModuleControllers: Function[] = [
    DiscussionController,
];

export const discussionsModuleValidators: Function[] = [];

export const discussionsContainerModules: ContainerModule[] = [
    new ContainerModule(options => {
        options.bind(DiscussionController).toSelf().inSingletonScope();
    }),
    sharedContainerModule,
];

export async function setupDiscussionsContainer(): Promise<void> {
    const container = new Container();
    await container.load(...discussionsContainerModules);
    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);
}

export const discussionsModuleOptions: RoutingControllersOptions = {
    controllers: [DiscussionController],
    middlewares: [],
    defaultErrorHandler: true,
    authorizationChecker: async function () {
        return true;
    },
    validation: true,
};
