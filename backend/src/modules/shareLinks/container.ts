import {ContainerModule} from 'inversify';
import {SHARE_LINKS_TYPES} from './types.js';
import {ShareLinkRepository} from '#shared/database/providers/mongo/repositories/ShareLinkRepository.js';
import {ShareLinkService} from './services/ShareLinkService.js';
import {YouTubeEmbedService} from './services/YouTubeEmbedService.js';
import {QuickShareService} from './services/QuickShareService.js';
import {ShareLinkMailService} from './services/ShareLinkMailService.js';
import {ShareLinkController} from './controllers/ShareLinkController.js';

export const shareLinksContainerModule = new ContainerModule(options => {
  // Repositories
  options
    .bind(SHARE_LINKS_TYPES.ShareLinkRepo)
    .to(ShareLinkRepository)
    .inSingletonScope();

  // Services
  options
    .bind(SHARE_LINKS_TYPES.ShareLinkService)
    .to(ShareLinkService)
    .inSingletonScope();
  options
    .bind(SHARE_LINKS_TYPES.YouTubeEmbedService)
    .to(YouTubeEmbedService)
    .inSingletonScope();
  options
    .bind(SHARE_LINKS_TYPES.QuickShareService)
    .to(QuickShareService)
    .inSingletonScope();
  options
    .bind(SHARE_LINKS_TYPES.ShareLinkMailService)
    .to(ShareLinkMailService)
    .inSingletonScope();

  // Controllers
  options.bind(ShareLinkController).toSelf().inSingletonScope();
});
