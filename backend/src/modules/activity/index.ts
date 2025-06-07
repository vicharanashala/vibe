import 'reflect-metadata';
import {Container} from 'inversify';
import {useContainer, RoutingControllersOptions} from 'routing-controllers';
import {FaceRecognitionController} from './controllers/FaceRecognitionController';
import {activityContainerModule} from './container';
import {InversifyAdapter} from '../../inversify-adapter';

// Setup function for the activity module container
export async function setupActivityContainer(): Promise<void> {
  const container = new Container();
  await container.load(activityContainerModule);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

// Export module configuration
export const activityModuleOptions: RoutingControllersOptions = {
  controllers: [FaceRecognitionController],
  middlewares: [],
  defaultErrorHandler: true,
  validation: true,
  authorizationChecker: async function () {
    return true; // Replace with actual auth logic if needed
  },
};

// Export service
export {FaceRecognitionService} from './services/FaceRecognitionService';

// Export controller
export {FaceRecognitionController} from './controllers/FaceRecognitionController';

// Export validators
export * from './classes/validators/FaceRecognitionValidators';
