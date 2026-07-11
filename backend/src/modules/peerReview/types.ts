const TYPES = {
  // Controllers
  PeerReviewAssessmentController: Symbol.for('PeerReviewAssessmentController'),
  PeerReviewSubmissionController: Symbol.for('PeerReviewSubmissionController'),
  PeerReviewAssignmentController: Symbol.for('PeerReviewAssignmentController'),
  PeerReviewTeacherController: Symbol.for('PeerReviewTeacherController'),
  // Services
  PeerReviewAssessmentService: Symbol.for('PeerReviewAssessmentService'),
  PeerReviewSubmissionService: Symbol.for('PeerReviewSubmissionService'),
  PeerReviewAssignmentService: Symbol.for('PeerReviewAssignmentService'),
  PeerReviewScoringService: Symbol.for('PeerReviewScoringService'),
  PeerReviewUrlAccessibilityChecker: Symbol.for('PeerReviewUrlAccessibilityChecker'),
  PeerReviewNotificationService: Symbol.for('PeerReviewNotificationService'),
  // Crons
  AssignmentRunner: Symbol.for('AssignmentRunner'),
  ReassignmentRunner: Symbol.for('ReassignmentRunner'),
  FinalizationRunner: Symbol.for('FinalizationRunner'),
  DueDateReminderRunner: Symbol.for('DueDateReminderRunner'),
  // Repositories
  PeerReviewAssessmentRepo: Symbol.for('PeerReviewAssessmentRepo'),
  PeerReviewSubmissionRepo: Symbol.for('PeerReviewSubmissionRepo'),
  PeerReviewAssignmentRepo: Symbol.for('PeerReviewAssignmentRepo'),
  PeerReviewReviewRepo: Symbol.for('PeerReviewReviewRepo'),
};

export { TYPES as PEERREVIEW_TYPES };