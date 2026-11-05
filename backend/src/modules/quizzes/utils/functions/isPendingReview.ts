/**
 * True for a question that has not been approved for grading yet — today, a
 * crowd-sourced student question still awaiting instructor review.
 *
 * Such a question must never be drawn into a graded attempt or carried into a
 * copied course, whichever bank it happens to sit in. Bank placement alone is
 * not a safe gate: V1.1 (#1070) put pending questions straight into graded
 * banks, and course copy/import then duplicated them. See
 * CROWD_QUESTION_BANK.md.
 */
export const isPendingReview = (question: {reviewStatus?: string} | null | undefined) =>
  question?.reviewStatus === 'PENDING_REVIEW';
