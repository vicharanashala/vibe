export interface PendingStudentQuestionContext {
  courseId: string;
  courseVersionId: string;
  segmentId: string;
}

export type StudentQuestionType = 'SELECT_ONE_IN_LOT';

export interface StudentQuestionOptionInput {
  text: string;
}

export interface StudentQuestionSubmissionPayload {
  questionType: StudentQuestionType;
  questionText: string;
  options: StudentQuestionOptionInput[];
  correctOptionIndex: number;
}

/** AI screening verdict returned by the submit endpoint. */
export type ScreeningDecision = 'pass' | 'reject' | 'hold';

export interface StudentQuestionSubmissionResult {
  decision: ScreeningDecision;
  reasonCode: string;
  message: string;
  /** Present unless rejected. */
  questionId?: string;
  /** For a 'typo' reject: corrected question text the student can one-tap apply. */
  suggestedFix?: string;
}

export type StudentQuestionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * Peer-validation lifecycle state; only meaningful while status === 'PENDING'.
 * COLLECTING = served ungraded to students, gathering answers + 👍/👎.
 * ELIGIBLE = passed the gate and now awaits instructor approval.
 */
export type StudentQuestionGateState = 'COLLECTING' | 'ELIGIBLE';

export interface StudentQuestionListItem {
  _id: string;
  segmentId: string;
  courseId?: string;
  courseVersionId?: string;
  questionText: string;
  options: {text: string}[];
  correctOptionIndex: number;
  status: StudentQuestionStatus;
  source: string;
  createdBy: string;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  gateState?: StudentQuestionGateState;
  responseCount?: number;
  correctCount?: number;
  thumbsUpCount?: number;
  thumbsDownCount?: number;
}

export interface StudentQuestionListResponse {
  items: StudentQuestionListItem[];
}

export type StudentQuestionStatusFilter =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'ALL';

export type StudentQuestionGateStateFilter = StudentQuestionGateState | 'ALL';

/**
 * Read-only context for the segment a submission was made against, shown in
 * the review screen's segment dialog. `quiz` is the quiz that would receive
 * the question on approval; it is absent when no quiz follows the segment.
 */
export interface SegmentDetails {
  segmentId: string;
  name?: string;
  description?: string;
  type?: string;
  videoDetails?: {
    URL?: string;
    startTime?: string;
    endTime?: string;
    points?: number;
  };
  quiz?: {
    itemId: string;
    name?: string;
  };
}

export interface UpdateStudentQuestionPayload {
  questionText?: string;
  options?: {text: string}[];
  correctOptionIndex?: number;
  status?: StudentQuestionStatus;
  reason?: string;
}
