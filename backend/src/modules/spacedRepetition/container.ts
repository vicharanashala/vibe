import { ContainerModule } from 'inversify';
import { ReviewItemRepository, StudentSRStatusRepository } from '#spacedRepetition/repositories/index.js';
import { SpacedRepetitionService } from './services/SpacedRepetitionService.js';
import { SpacedRepetitionController } from './controllers/SpacedRepetitionController.js';
import { SPACED_REPETITION_TYPES } from './types.js';

export const spacedRepetitionContainerModule = new ContainerModule(options => {
  // Repository
  options
    .bind(SPACED_REPETITION_TYPES.ReviewItemRepo)
    .to(ReviewItemRepository)
    .inSingletonScope();

  options
    .bind(SPACED_REPETITION_TYPES.StudentSRStatusRepo)
    .to(StudentSRStatusRepository)
    .inSingletonScope();

  // Service
  options
    .bind(SPACED_REPETITION_TYPES.SpacedRepetitionService)
    .to(SpacedRepetitionService)
    .inSingletonScope();

  // Controller
  options
    .bind(SpacedRepetitionController)
    .toSelf()
    .inSingletonScope();
});