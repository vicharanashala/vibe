import { ContainerModule } from 'inversify';
import { PEERREVIEW_TYPES } from './types.js';
import { PeerReviewAssessmentRepository } from './repositories/providers/mongodb/PeerReviewAssessmentRepository.js';
import { PeerReviewSubmissionRepository } from './repositories/providers/mongodb/PeerReviewSubmissionRepository.js';
import { PeerReviewAssignmentRepository } from './repositories/providers/mongodb/PeerReviewAssignmentRepository.js';
import { PeerReviewReviewRepository } from './repositories/providers/mongodb/PeerReviewReviewRepository.js';
import { PeerReviewAssessmentService } from './services/PeerReviewAssessmentService.js';
import { PeerReviewAssessmentController } from './controllers/PeerReviewAssessmentController.js';

/**
 * DI bindings for the peerReview module.
 *
 * Bindings (Phase 1+2):
 *   - 4 repositories (data layer)
 *   - 1 service (assessment create/edit/get/close)
 *   - 1 controller (3 endpoints)
 *
 * Each binding is a singleton.
 */
export const peerReviewContainerModule = new ContainerModule(options => {
  // Repositories
  options
    .bind(PEERREVIEW_TYPES.PeerReviewAssessmentRepo)
    .to(PeerReviewAssessmentRepository)
    .inSingletonScope();
  options
    .bind(PEERREVIEW_TYPES.PeerReviewSubmissionRepo)
    .to(PeerReviewSubmissionRepository)
    .inSingletonScope();
  options
    .bind(PEERREVIEW_TYPES.PeerReviewAssignmentRepo)
    .to(PeerReviewAssignmentRepository)
    .inSingletonScope();
  options
    .bind(PEERREVIEW_TYPES.PeerReviewReviewRepo)
    .to(PeerReviewReviewRepository)
    .inSingletonScope();

  // Services
  options
    .bind(PEERREVIEW_TYPES.PeerReviewAssessmentService)
    .to(PeerReviewAssessmentService)
    .inSingletonScope();

  // Controllers
  options
    .bind(PEERREVIEW_TYPES.PeerReviewAssessmentController)
    .to(PeerReviewAssessmentController)
    .inSingletonScope();
});