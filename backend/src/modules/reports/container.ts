import {ContainerModule} from 'inversify';
import { ReportService } from './services/ReportService.js';
import { REPORT_TYPES } from './types.js';
import { ReportController } from './controllers/ReportController.js';
import { ReportRepository } from './repositories/index.js';

export const reportsContainerModule = new ContainerModule(options => {
    // Repositories

    options.bind(REPORT_TYPES.ReportRepo).to(ReportRepository).inSingletonScope();

    // Services

    options.bind(REPORT_TYPES.ReportService).to(ReportService).inSingletonScope();

    // Controllers

    options.bind(ReportController).toSelf().inSingletonScope();

});
