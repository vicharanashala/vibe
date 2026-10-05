import { ContainerModule } from 'inversify';
import { MotivationController } from './controllers/MotivationController.js';
import {
  UserDirectoryRepository,
  OptOutRepository,
} from './repositories/index.js';
import { MOTIVATION_TYPES } from './types.js';

export const motivationContainerModule = new ContainerModule((options) => {
  // Repository — added 2026-07-25 for student-name resolution
  // (Day 3 Plan A2). Mirrors the StudentSRStatusRepository pattern
  // from the spaced repetition module: cross-module access narrowed
  // to a single file with one responsibility.
  options
    .bind(MOTIVATION_TYPES.UserDirectoryRepo)
    .to(UserDirectoryRepository)
    .inSingletonScope();

  // Repository — added 2026-07-25 for Pillar 3 (public opt-out).
  // Owns the `motivation_opt_outs` collection. The threshold check
  // (30-day retention ≥ 90% AND 30-day reviews ≥ 100) lives in the
  // controller, not here — this repo is a thin storage adapter.
  options
    .bind(MOTIVATION_TYPES.OptOutRepo)
    .to(OptOutRepository)
    .inSingletonScope();

  // Controller
  options
    .bind(MotivationController)
    .toSelf()
    .inSingletonScope();
});