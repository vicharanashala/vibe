import {ContainerModule} from 'inversify';
import TYPES from './types.js';
import {FaceRecognitionService} from './services/FaceRecognitionService.js';
import {FaceRecognitionController} from './controllers/FaceRecognitionController.js';

export const activityContainerModule = new ContainerModule(options => {
  // Services
  options
    .bind(TYPES.FaceRecognitionService)
    .to(FaceRecognitionService)
    .inSingletonScope();

  // Controllers
  options.bind(FaceRecognitionController).toSelf().inSingletonScope();
});
