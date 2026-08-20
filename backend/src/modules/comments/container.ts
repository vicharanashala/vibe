import {ContainerModule} from 'inversify';
import {COMMENTS_TYPES} from './types.js';
import {CommentService} from './services/CommentService.js';
import {CommentController} from './controllers/CommentController.js';
import {CommentRepository} from './repositories/providers/mongodb/CommentRepository.js';

export const commentsContainerModule = new ContainerModule(options => {
  // Repository
  options.bind(CommentRepository).toSelf().inSingletonScope();
  options.bind(COMMENTS_TYPES.CommentRepo).to(CommentRepository);

  // Service
  options.bind(CommentService).toSelf().inSingletonScope();
  options.bind(COMMENTS_TYPES.CommentService).to(CommentService);

  // Controller
  options.bind(CommentController).toSelf().inSingletonScope();
});
