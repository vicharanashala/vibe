const TYPES = {
  // Controllers
  PeerReviewAssessmentController: Symbol.for('PeerReviewAssessmentController'),
  PeerReviewSubmissionController: Symbol.for('PeerReviewSubmissionController'),
  PeerReviewAssignmentController: Symbol.for('PeerReviewAssignmentController'),
  // Services
  PeerReviewAssessmentService: Symbol.for('PeerReviewAssessmentService'),
  PeerReviewSubmissionService: Symbol.for('PeerReviewSubmissionService'),
  PeerReviewUrlAccessibilityChecker: Symbol.for('PeerReviewUrlAccessibilityChecker'),
  PeerReviewAssignmentService: Symbol.for('PeerReviewAssignmentService'),
  PeerReviewNotificationService: Symbol.for('PeerReviewNotificationService'),
  // Crons
  AssignmentRunner: Symbol.for('AssignmentRunner'),
  ReassignmentRunner: Symbol.for('ReassignmentRunner'),
  FinalizationRunner: Symbol.for('FinalizationRunner'),
  // Repositories
  PeerReviewAssessmentRepo: Symbol.for('PeerReviewAssessmentRepo'),
  PeerReviewSubmissionRepo: Symbol.for('PeerReviewSubmissionRepo'),
  PeerReviewAssignmentRepo: Symbol.for('PeerReviewAssignmentRepo'),
  PeerReviewReviewRepo: Symbol.for('PeerReviewReviewRepo'),
};

export { TYPES as PEERREVIEW_TYPES };