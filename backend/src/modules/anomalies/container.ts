import { ContainerModule } from 'inversify';
import { AnomalyRepository } from './repositories/providers/mongodb/AnomalyRepository.js';
import { AnomalyService } from './services/AnomalyService.js';
import { AnomalyController } from './controllers/AnomalyController.js';
import { ANOMALIES_TYPES } from './types.js';
import { CloudStorageService } from './services/CloudStorageService.js';
import { ImageProcessingService } from './services/ImageProcessingService.js';
import { AnomalyTransformationService } from './services/AnomalyTransformationService.js';
import { AnomalyDecryptionService } from './services/AnomalyDecryptionService.js';

export const anomaliesContainerModule = new ContainerModule(options => {
  // Repositories
  options.bind(ANOMALIES_TYPES.AnomalyRepository).to(AnomalyRepository).inSingletonScope();
  
  // Services
  options.bind(ANOMALIES_TYPES.ImageProcessingService).to(ImageProcessingService).inSingletonScope(); 
  options.bind(ANOMALIES_TYPES.AnomalyService).to(AnomalyService).inSingletonScope();
  options.bind(ANOMALIES_TYPES.CloudStorageService).to(CloudStorageService).inSingletonScope();
  options.bind(ANOMALIES_TYPES.AnomalyTransformationService).to(AnomalyTransformationService).inSingletonScope();
  options.bind(ANOMALIES_TYPES.AnomalyDecryptionService).to(AnomalyDecryptionService).inSingletonScope();
  
  // Controllers
  options.bind(AnomalyController).toSelf().inSingletonScope();
});