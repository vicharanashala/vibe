import {ContainerModule} from 'inversify';
import {ANALYTICS_TYPES} from './types.js';
import {AnalyticsRepository} from './repositories/AnalyticsRepository.js';
import {AnalyticsSourceReader} from './repositories/AnalyticsSourceReader.js';
import {AnalyticsProjector} from './services/AnalyticsProjector.js';
import {AnalyticsQueryService} from './services/AnalyticsQueryService.js';
import {AnalyticsController} from './controllers/AnalyticsController.js';

export const analyticsContainerModule = new ContainerModule(options => {
  options
    .bind(ANALYTICS_TYPES.AnalyticsRepository)
    .to(AnalyticsRepository)
    .inSingletonScope();
  options
    .bind(ANALYTICS_TYPES.AnalyticsSourceReader)
    .to(AnalyticsSourceReader)
    .inSingletonScope();
  options
    .bind(ANALYTICS_TYPES.AnalyticsProjector)
    .to(AnalyticsProjector)
    .inSingletonScope();
  options
    .bind(ANALYTICS_TYPES.AnalyticsQueryService)
    .to(AnalyticsQueryService)
    .inSingletonScope();
  options.bind(AnalyticsController).toSelf().inSingletonScope();
});
