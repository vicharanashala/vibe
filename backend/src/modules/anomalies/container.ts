import { ContainerModule } from 'inversify';
import { AnomalyRepository } from './repositories/providers/mongodb/AnomalyRepository.js';
import { AnomalyService } from './services/AnomalyService.js';
import { AnomalyController } from './controllers/AnomalyController.js';
import { ANOMALIES_TYPES } from './types.js';
import { CloudStorageService } from './services/CloudStorageService.js';
import { MediaProcessingService } from './services/MediaProcessingService.js';

export const anomaliesContainerModule = new ContainerModule(options => {
  // Repositories
  options.bind(ANOMALIES_TYPES.AnomalyRepository).to(AnomalyRepository).inSingletonScope();
  
  // Services
  options.bind(ANOMALIES_TYPES.MediaProcessingService).to(MediaProcessingService).inSingletonScope();
  options.bind(ANOMALIES_TYPES.AnomalyService).to(AnomalyService).inSingletonScope();
  options.bind(ANOMALIES_TYPES.CloudStorageService).to(CloudStorageService).inSingletonScope();
  
  // Controllers
  options.bind(AnomalyController).toSelf().inSingletonScope();
});