import {ContainerModule} from 'inversify';
import { AuditTrailsController } from './controllers/AuditTrailsController.js';
import { AuditTrailsService } from './services/AuditTrailsService.js';
import { AUDIT_TRAILS_TYPES } from './types.js';
import { AuditTrailsRepository } from './repositories/index.js';



export const auditTrailsContainerModule = new ContainerModule(options => {
    // Repositories

    options.bind(AUDIT_TRAILS_TYPES.AuditTrailsRepository).to(AuditTrailsRepository).inSingletonScope();

    // Services
    options.bind(AUDIT_TRAILS_TYPES.AuditTrailsService).to(AuditTrailsService).inSingletonScope();
    
    // Controllers
    options.bind(AuditTrailsController).toSelf().inSingletonScope();

})