import {ObjectId} from 'mongodb';

export type StudentQuestionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type StudentQuestionSource = 'STUDENT_GENERATED';

export type StudentQuestionType = 'SELECT_ONE_IN_LOT';

export interface IStudentQuestionOption {
  text: string;
}

export interface IStudentSegmentQuestion {
  _id?: ObjectId;
  courseId: ObjectId;
  courseVersionId: ObjectId;
  segmentId: ObjectId;
  questionType: StudentQuestionType;
  questionText: string;
  options: IStudentQuestionOption[];
  correctOptionIndex: number;
  normalizedSignature: string;
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
}

export class StudentSegmentQuestion implements IStudentSegmentQuestion {
  _id?: ObjectId;
  courseId: ObjectId;
  courseVersionId: ObjectId;
  segmentId: ObjectId;
  questionType: StudentQuestionType;
  questionText: string;
  options: IStudentQuestionOption[];
  correctOptionIndex: number;
  normalizedSignature: string;
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

  constructor(input: {
    courseId: string;
    courseVersionId: string;
    segmentId: string;
    questionType: StudentQuestionType;
    questionText: string;
    options: IStudentQuestionOption[];
    correctOptionIndex: number;
    normalizedSignature: string;
    createdBy: string;
  }) {
    this.courseId = new ObjectId(input.courseId);
    this.courseVersionId = new ObjectId(input.courseVersionId);
    this.segmentId = new ObjectId(input.segmentId);
    this.questionType = input.questionType;
    this.questionText = input.questionText;
    this.options = input.options;
    this.correctOptionIndex = input.correctOptionIndex;
    this.normalizedSignature = input.normalizedSignature;
    this.status = 'PENDING';
    this.source = 'STUDENT_GENERATED';
    this.createdBy = new ObjectId(input.createdBy);
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.isDeleted = false;
  }
}
