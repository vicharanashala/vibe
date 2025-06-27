import {ContainerModule} from 'inversify';
import { NOTIFICATIONS_TYPES } from './types.js';
import {EnrollmentRepository} from '#shared/database/providers/mongo/repositories/EnrollmentRepository.js';
import { UserRepository } from '#shared/database/index.js';
import {CourseRepository} from '#shared/database/providers/mongo/repositories/CourseRepository.js';
import { InviteRepository } from '#shared/database/index.js';
import {MailService, InviteService} from './services/index.js';
import {InviteController} from './controllers/index.js';

export const notificationsContainerModule = new ContainerModule(options => {
  // Repositories
  options.bind(NOTIFICATIONS_TYPES.InviteRepo).to(InviteRepository).inSingletonScope();
  
  // Services
  options.bind(NOTIFICATIONS_TYPES.MailService).to(MailService).inSingletonScope();
  options.bind(NOTIFICATIONS_TYPES.InviteService).to(InviteService).inSingletonScope();

  // Controllers
  options.bind(InviteController).toSelf().inSingletonScope();
});

