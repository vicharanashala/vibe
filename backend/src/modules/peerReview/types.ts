const TYPES = {
  // Controllers
  PeerReviewAssessmentController: Symbol.for('PeerReviewAssessmentController'),
  PeerReviewSubmissionController: Symbol.for('PeerReviewSubmissionController'),
  // Services
  PeerReviewAssessmentService: Symbol.for('PeerReviewAssessmentService'),
  PeerReviewSubmissionService: Symbol.for('PeerReviewSubmissionService'),
  PeerReviewUrlAccessibilityChecker: Symbol.for('PeerReviewUrlAccessibilityChecker'),
  // Repositories
  PeerReviewAssessmentRepo: Symbol.for('PeerReviewAssessmentRepo'),
  PeerReviewSubmissionRepo: Symbol.for('PeerReviewSubmissionRepo'),
  PeerReviewAssignmentRepo: Symbol.for('PeerReviewAssignmentRepo'),
  PeerReviewReviewRepo: Symbol.for('PeerReviewReviewRepo'),
};

export { TYPES as PEERREVIEW_TYPES };