import { ContainerModule } from 'inversify';
import { PEERREVIEW_TYPES } from './types.js';
import { PeerReviewAssessmentRepository } from './repositories/providers/mongodb/PeerReviewAssessmentRepository.js';
import { PeerReviewSubmissionRepository } from './repositories/providers/mongodb/PeerReviewSubmissionRepository.js';
import { PeerReviewAssignmentRepository } from './repositories/providers/mongodb/PeerReviewAssignmentRepository.js';
import { PeerReviewReviewRepository } from './repositories/providers/mongodb/PeerReviewReviewRepository.js';

/**
 * DI bindings for the peerReview module.
 *
 * Bindings:
 *   - 4 repositories (Phase 1; data layer)
 *   - services and controllers will be added in Phases 2–5
 *
 * Each binding is a singleton — the repositories are stateless besides the
 * lazily-initialized `Collection<T>` reference (set in init()).
 */
export const peerReviewContainerModule = new ContainerModule(options => {
  // Repositories (Phase 1)
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

  // Services (Phases 2–5)

  // Controllers (Phases 2–5)
});