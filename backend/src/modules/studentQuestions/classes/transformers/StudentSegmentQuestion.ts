import {ObjectId} from 'mongodb';

export type StudentQuestionStatus =
  | 'UNVERIFIED'
  | 'TO_BE_VALIDATED'
  | 'VALIDATED'
  | 'REJECTED';

export type StudentQuestionSource =
  | 'STUDENT_GENERATED'
  | 'INSTRUCTOR_GENERATED'
  | 'AI_GENERATED';

export type StudentQuestionType = 'SELECT_ONE_IN_LOT';

export type CrowdValidationState =
  | 'PENDING_CROWD_DATA'
  | 'READY_FOR_CROWD'
  | 'KEPT'
  | 'DISCARDED'
  | 'FLAGGED_FOR_REVISION';

export interface ICrowdValidationMetrics {
  totalAttempts: number;
  correctAttempts: number;
  correctRate?: number; // Computed: correctAttempts / totalAttempts
}

export interface IStudentQuestionOption {
  text?: string;
  imageUrl?: string;
}

export interface IStudentSegmentQuestion {
  _id?: ObjectId;
  courseId: ObjectId;
  courseVersionId: ObjectId;
  segmentId: ObjectId;
  questionType: StudentQuestionType;
  questionText: string;
  questionImageUrl?: string;
  options: IStudentQuestionOption[];
  correctOptionIndex: number;
  normalizedQuestionText: string;
  status: StudentQuestionStatus;
  source: StudentQuestionSource;
  createdBy: ObjectId;
  reviewedBy?: ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
  isDeleted?: boolean;
  deletedAt?: Date;
  // Crowd validation fields (V2.0)
  crowdValidationState?: CrowdValidationState;
  crowdValidationMetrics?: ICrowdValidationMetrics;
  lastValidationCheck?: Date;
}

export class StudentSegmentQuestion implements IStudentSegmentQuestion {
  _id?: ObjectId;
  courseId: ObjectId;
  courseVersionId: ObjectId;
  segmentId: ObjectId;
  questionType: StudentQuestionType;
  questionText: string;
  questionImageUrl?: string;
  options: IStudentQuestionOption[];
  correctOptionIndex: number;
  normalizedQuestionText: string;
  status: StudentQuestionStatus;
  source: StudentQuestionSource;
  createdBy: ObjectId;
  reviewedBy?: ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
  isDeleted?: boolean;
  deletedAt?: Date;
  // Crowd validation fields (V2.0)
  crowdValidationState?: CrowdValidationState;
  crowdValidationMetrics?: ICrowdValidationMetrics;
  lastValidationCheck?: Date;

  constructor(input: {
    courseId: string;
    courseVersionId: string;
    segmentId: string;
    questionType: StudentQuestionType;
    questionText: string;
    questionImageUrl?: string;
    options: IStudentQuestionOption[];
    correctOptionIndex: number;
    normalizedQuestionText: string;
    createdBy: string;
  }) {
    this.courseId = new ObjectId(input.courseId);
    this.courseVersionId = new ObjectId(input.courseVersionId);
    this.segmentId = new ObjectId(input.segmentId);
    this.questionType = input.questionType;
    this.questionText = input.questionText;
    this.questionImageUrl = input.questionImageUrl;
    this.options = input.options;
    this.correctOptionIndex = input.correctOptionIndex;
    this.normalizedQuestionText = input.normalizedQuestionText;
    this.status = 'UNVERIFIED';
    this.source = 'STUDENT_GENERATED';
    this.createdBy = new ObjectId(input.createdBy);
    this.reviewedBy = undefined;
    this.reviewedAt = undefined;
    this.rejectionReason = undefined;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.isDeleted = false;
    // Initialize crowd validation fields
    this.crowdValidationState = 'PENDING_CROWD_DATA';
    this.crowdValidationMetrics = { totalAttempts: 0, correctAttempts: 0 };
    this.lastValidationCheck = undefined;
  }
}
