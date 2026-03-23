import {ContainerModule} from 'inversify';
import {NOTIFICATIONS_TYPES} from './types.js';
import {InviteRepository} from '#shared/database/index.js';
import {MailService, InviteService} from './services/index.js';
import {InviteController} from './controllers/index.js';
import {NotificationRepository} from '#root/shared/database/providers/mongo/repositories/NotificationRepository.js';
import {NotificationService} from './services/NotificationService.js';
import {NotificationController} from './controllers/NotificationController.js';

export const notificationsContainerModule = new ContainerModule(options => {
  // Repositories
  options
    .bind(NOTIFICATIONS_TYPES.InviteRepo)
    .to(InviteRepository)
    .inSingletonScope();
  options
    .bind(NOTIFICATIONS_TYPES.NotificationRepo)
    .to(NotificationRepository)
    .inSingletonScope();

  // Services
  options
    .bind(NOTIFICATIONS_TYPES.MailService)
    .to(MailService)
    .inSingletonScope();
  options
    .bind(NOTIFICATIONS_TYPES.InviteService)
    .to(InviteService)
    .inSingletonScope();
  options
    .bind(NOTIFICATIONS_TYPES.NotificationService)
    .to(NotificationService)
    .inSingletonScope();

  // Controllers
  options.bind(InviteController).toSelf().inSingletonScope();
  options.bind(NotificationController).toSelf().inSingletonScope();
});
