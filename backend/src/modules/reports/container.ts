import {ContainerModule} from 'inversify';
import { ReportService } from './services/ReportService.js';
import { REPORT_TYPES } from './types.js';
import { ReportController } from './controllers/ReportController.js';

export const reportsContainerModule = new ContainerModule(options => {
    // Repositories

    // options.bind(REPORT_TYPES.ReportRepo).to().inSingletonScope();

    // Services

    options.bind(REPORT_TYPES.ReportService).to(ReportService).inSingletonScope();

    // Controllers

    options.bind(ReportController).toSelf().inSingletonScope();

});
