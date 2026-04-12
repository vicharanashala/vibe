import {Container, ContainerModule} from 'inversify';
import { auditTrailsContainerModule } from './container.js';
import { AuditTrailsController } from './controllers/AuditTrailsController.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {useContainer} from 'class-validator';
import { RoutingControllersOptions } from 'routing-controllers';
import { authorizationChecker, HttpErrorHandler } from '#root/shared/index.js';



export const auditTrailsContainerModules: ContainerModule[] = [
    auditTrailsContainerModule,
]


export const auditTrailsModuleControllers: Function[] = [AuditTrailsController];

export async function setupAuditTrailsContainer(): Promise<void> {
    const container = new Container();
    await container.load(...auditTrailsContainerModules);
    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);
}

export const auditTrailsModuleOptions: RoutingControllersOptions = {
    controllers: auditTrailsModuleControllers,
    middlewares: [HttpErrorHandler],
    defaultErrorHandler: false,
    authorizationChecker,
    validation: true,
};