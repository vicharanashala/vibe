import {ContainerModule} from 'inversify';
import {DISCUSSIONBOARD_TYPES} from './types.js';
import {DiscussionService} from './services/DiscussionService.js';
import {DiscussionController} from './controllers/DiscussionController.js';
import {DiscussionThreadRepository} from './repositories/providers/mongodb/DiscussionThreadRepository.js';
import {DiscussionReplyRepository} from './repositories/providers/mongodb/DiscussionReplyRepository.js';

export const discussionBoardContainerModule = new ContainerModule(options => {
  // Repositories
  options
    .bind(DISCUSSIONBOARD_TYPES.DiscussionThreadRepository)
    .to(DiscussionThreadRepository)
    .inSingletonScope();

  options
    .bind(DISCUSSIONBOARD_TYPES.DiscussionReplyRepository)
    .to(DiscussionReplyRepository)
    .inSingletonScope();

  // Service
  options
    .bind(DISCUSSIONBOARD_TYPES.DiscussionService)
    .to(DiscussionService)
    .inSingletonScope();

  // Controller — bind by class (not symbol) so the routing-controllers
  // InversifyAdapter can resolve it via `container.get(DiscussionController)`.
  options.bind(DiscussionController).toSelf().inSingletonScope();
});
