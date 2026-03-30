import {ContainerModule} from 'inversify';
import {ACHIEVEMENTS_TYPES} from './types.js';
import {AchievementRepository} from './repositories/AchievementRepository.js';
import {AchievementService} from './services/AchievementService.js';
import {AchievementController} from './controllers/AchievementController.js';

export const achievementsContainerModule = new ContainerModule(options => {
  // Repositories
  options
    .bind(ACHIEVEMENTS_TYPES.AchievementRepo)
    .to(AchievementRepository)
    .inSingletonScope();

  // Services
  options
    .bind(ACHIEVEMENTS_TYPES.AchievementService)
    .to(AchievementService)
    .inSingletonScope();

  // Controllers
  options.bind(AchievementController).toSelf().inSingletonScope();
});
