import { ContainerModule } from 'inversify';
import { ANNOUNCEMENTS_TYPES } from './types.js';
import { AnnouncementRepository } from '#shared/database/providers/mongo/repositories/AnnouncementRepository.js';
import { AnnouncementService } from './services/AnnouncementService.js';
import { AnnouncementController } from './controllers/AnnouncementController.js';

export const announcementsContainerModule = new ContainerModule(options => {
    // Repositories
    options
        .bind(ANNOUNCEMENTS_TYPES.AnnouncementRepo)
        .to(AnnouncementRepository)
        .inSingletonScope();

    // Services
    options
        .bind(ANNOUNCEMENTS_TYPES.AnnouncementService)
        .to(AnnouncementService)
        .inSingletonScope();

    // Controllers
    options.bind(AnnouncementController).toSelf().inSingletonScope();
});
