import { ContainerModule } from 'inversify';
import { PEERREVIEW_TYPES } from './types.js';
import { PeerReviewAssessmentRepository } from './repositories/providers/mongodb/PeerReviewAssessmentRepository.js';
import { PeerReviewSubmissionRepository } from './repositories/providers/mongodb/PeerReviewSubmissionRepository.js';
import { PeerReviewAssignmentRepository } from './repositories/providers/mongodb/PeerReviewAssignmentRepository.js';
import { PeerReviewReviewRepository } from './repositories/providers/mongodb/PeerReviewReviewRepository.js';
import { PeerReviewAssessmentService } from './services/PeerReviewAssessmentService.js';
import { PeerReviewSubmissionService } from './services/PeerReviewSubmissionService.js';
import { PeerReviewAssignmentService } from './services/PeerReviewAssignmentService.js';
import { PeerReviewScoringService } from './services/PeerReviewScoringService.js';
import { PeerReviewUrlAccessibilityService } from './services/PeerReviewUrlAccessibilityService.js';
import { PeerReviewNotificationService } from './services/PeerReviewNotificationService.js';
import { PeerReviewAssessmentController } from './controllers/PeerReviewAssessmentController.js';
import { PeerReviewSubmissionController } from './controllers/PeerReviewSubmissionController.js';
import { PeerReviewAssignmentController } from './controllers/PeerReviewAssignmentController.js';
import { PeerReviewTeacherController } from './controllers/PeerReviewTeacherController.js';
import { AssignmentRunner } from './cron/AssignmentRunner.js';
import { ReassignmentRunner } from './cron/ReassignmentRunner.js';
import { FinalizationRunner } from './cron/FinalizationRunner.js';

/**
 * DI bindings for the peerReview module.
 *
 * Bindings (Phase 1+2+3+4):
 *   - 4 repositories (data layer)
 *   - 4 services (assessment, submission, URL accessibility, assignment)
 *   - 2 controllers (assessment teacher-side, submission student-side)
 *   - 3 cron runners (assignment, reassignment, finalization)
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
    .bind(PEERREVIEW_TYPES.PeerReviewAssignmentService)
    .to(PeerReviewAssignmentService)
    .inSingletonScope();
  options
    .bind(PEERREVIEW_TYPES.PeerReviewScoringService)
    .to(PeerReviewScoringService)
    .inSingletonScope();
  options
    .bind(PEERREVIEW_TYPES.PeerReviewUrlAccessibilityChecker)
    .to(PeerReviewUrlAccessibilityService)
    .inSingletonScope();
  options
    .bind(PEERREVIEW_TYPES.PeerReviewNotificationService)
    .to(PeerReviewNotificationService)
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
  options
    .bind(PEERREVIEW_TYPES.PeerReviewAssignmentController)
    .to(PeerReviewAssignmentController)
    .inSingletonScope();
  options
    .bind(PEERREVIEW_TYPES.PeerReviewTeacherController)
    .to(PeerReviewTeacherController)
    .inSingletonScope();

  // Crons
  options
    .bind(PEERREVIEW_TYPES.AssignmentRunner)
    .to(AssignmentRunner)
    .inSingletonScope();
  options
    .bind(PEERREVIEW_TYPES.ReassignmentRunner)
    .to(ReassignmentRunner)
    .inSingletonScope();
  options
    .bind(PEERREVIEW_TYPES.FinalizationRunner)
    .to(FinalizationRunner)
    .inSingletonScope();
});