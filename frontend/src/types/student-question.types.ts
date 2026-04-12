export interface PendingStudentQuestionContext {
  courseId: string;
  courseVersionId: string;
  segmentId: string;
}

export type StudentQuestionType = 'SELECT_ONE_IN_LOT';

export interface StudentQuestionOptionInput {
  text?: string;
  imageUrl?: string;
}

export interface StudentQuestionSubmissionPayload {
  questionType: StudentQuestionType;
  questionText: string;
  questionImageUrl?: string;
  options: StudentQuestionOptionInput[];
  correctOptionIndex: number;
}

export type StudentQuestionStatus =
  | 'UNVERIFIED'
  | 'TO_BE_VALIDATED'
  | 'VALIDATED'
  | 'REJECTED';

export interface StudentQuestionListItem {
  _id: string;
  questionType: StudentQuestionType;
  questionText: string;
  questionImageUrl?: string;
  options: StudentQuestionOptionInput[];
  correctOptionIndex: number;
  status: StudentQuestionStatus;
  source: string;
  createdBy: string;
  createdAt: string;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface StudentQuestionListResponse {
  items: StudentQuestionListItem[];
}