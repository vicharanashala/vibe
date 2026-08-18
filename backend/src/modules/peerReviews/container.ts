import {ContainerModule} from 'inversify';
import {PEER_REVIEW_TYPES} from './types.js';
import {ReflectionService} from './services/ReflectionService.js';
import {ReflectionController} from './controllers/ReflectionController.js';
import {ReflectionRepository} from './repositories/providers/mongodb/ReflectionRepository.js';

export const peerReviewsContainerModule = new ContainerModule(options => {
  // Repository
  options.bind(ReflectionRepository).toSelf().inSingletonScope();
  options.bind(PEER_REVIEW_TYPES.ReflectionRepo).to(ReflectionRepository);

  // Service
  options.bind(ReflectionService).toSelf().inSingletonScope();
  options.bind(PEER_REVIEW_TYPES.ReflectionService).to(ReflectionService);

  // Controller
  options.bind(ReflectionController).toSelf().inSingletonScope();
});
