import { ContainerModule } from 'inversify';
import { PEERREVIEW_TYPES } from './types.js';
import { PeerReviewAssessmentRepository } from './repositories/providers/mongodb/PeerReviewAssessmentRepository.js';
import { PeerReviewSubmissionRepository } from './repositories/providers/mongodb/PeerReviewSubmissionRepository.js';
import { PeerReviewAssignmentRepository } from './repositories/providers/mongodb/PeerReviewAssignmentRepository.js';
import { PeerReviewReviewRepository } from './repositories/providers/mongodb/PeerReviewReviewRepository.js';
import { PeerReviewAssessmentService } from './services/PeerReviewAssessmentService.js';
import { PeerReviewSubmissionService } from './services/PeerReviewSubmissionService.js';
import { PeerReviewUrlAccessibilityService } from './services/PeerReviewUrlAccessibilityService.js';
import { PeerReviewAssessmentController } from './controllers/PeerReviewAssessmentController.js';
import { PeerReviewSubmissionController } from './controllers/PeerReviewSubmissionController.js';

/**
 * DI bindings for the peerReview module.
 *
 * Bindings (Phase 1+2+3):
 *   - 4 repositories (data layer)
 *   - 3 services (assessment, submission, URL accessibility)
 *   - 2 controllers (assessment teacher-side, submission student-side)
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
  options
    .bind(PEERREVIEW_TYPES.PeerReviewSubmissionService)
    .to(PeerReviewSubmissionService)
    .inSingletonScope();
  options
    .bind(PEERREVIEW_TYPES.PeerReviewUrlAccessibilityChecker)
    .to(PeerReviewUrlAccessibilityService)
    .inSingletonScope();

  // Controllers
  options
    .bind(PEERREVIEW_TYPES.PeerReviewAssessmentController)
    .to(PeerReviewAssessmentController)
    .inSingletonScope();
  options
    .bind(PEERREVIEW_TYPES.PeerReviewSubmissionController)
    .to(PeerReviewSubmissionController)
    .inSingletonScope();
});