import {ContainerModule} from 'inversify';
import TYPES from './types';
import {FaceRecognitionService} from './services/FaceRecognitionService';
import {FaceRecognitionController} from './controllers/FaceRecognitionController';

export const activityContainerModule = new ContainerModule(options => {
  // Services
  options
    .bind(TYPES.FaceRecognitionService)
    .to(FaceRecognitionService)
    .inSingletonScope();

  // Controllers
  options.bind(FaceRecognitionController).toSelf().inSingletonScope();
});
