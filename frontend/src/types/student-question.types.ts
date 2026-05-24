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

export type StudentQuestionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface StudentQuestionListItem {
  _id: string;
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
}

export interface StudentQuestionListResponse {
  items: StudentQuestionListItem[];
}
