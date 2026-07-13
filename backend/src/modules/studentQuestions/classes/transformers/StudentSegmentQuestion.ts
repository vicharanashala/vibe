import {ObjectId} from 'mongodb';

/**
 * PENDING  = passed screening; in the collecting/review flow.
 * HELD     = screening was unsure (or unavailable) — awaits instructor decision.
 * REJECTED = screening or an instructor rejected it (a lightweight stub is kept).
 * APPROVED = instructor approved.
 */
export type StudentQuestionStatus = 'PENDING' | 'HELD' | 'APPROVED' | 'REJECTED';

/** Persisted outcome of the automated screening filter (see services/screening). */
export interface IScreeningVerdict {
  decision: 'pass' | 'reject' | 'hold';
  reasonCode: string;
  check: string;
  message: string;
  /** The model's one-line justification — shown to the instructor reviewing a HELD question. */
  reason?: string;
  checks: {admissible?: boolean; notDuplicate?: boolean; onTopic?: boolean; answerCorrect?: boolean};
  matchQuestion?: string;
  provider: string;
  model: string;
  latencyMs: number;
  at: Date;
}

/**
 * Peer-validation lifecycle of a PENDING question (see CROWD_QUESTION_BANK.md).
 * COLLECTING = served ungraded to students, gathering answers + 👍/👎.
 * ELIGIBLE  = passed the gate (responseCount ≥ 200, correctRate ∈ [0.30,0.70],
 *             thumbsDownRate < 0.10) and now awaits instructor approval.
 * Only meaningful while `status === 'PENDING'`.
 */
export type StudentQuestionGateState = 'COLLECTING' | 'ELIGIBLE';

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
  promotedQuestionId?: ObjectId;
  // Peer-validation (stage 2) — only used while status === 'PENDING'.
  gateState?: StudentQuestionGateState;
  responseCount?: number;
  correctCount?: number;
  thumbsUpCount?: number;
  thumbsDownCount?: number;
  eligibleAt?: Date;
  /** Automated screening outcome (persisted for every screened submission). */
  screening?: IScreeningVerdict;
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
  promotedQuestionId?: ObjectId;
  gateState?: StudentQuestionGateState;
  responseCount?: number;
  correctCount?: number;
  thumbsUpCount?: number;
  thumbsDownCount?: number;
  eligibleAt?: Date;
  screening?: IScreeningVerdict;

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
    /** Screening outcome — defaults to a normal PENDING/COLLECTING record. */
    status?: StudentQuestionStatus;
    screening?: IScreeningVerdict;
    rejectionReason?: string;
  }) {
    this.courseId = new ObjectId(input.courseId);
    this.courseVersionId = new ObjectId(input.courseVersionId);
    this.segmentId = new ObjectId(input.segmentId);
    this.questionType = input.questionType;
    this.questionText = input.questionText;
    this.options = input.options;
    this.correctOptionIndex = input.correctOptionIndex;
    this.normalizedSignature = input.normalizedSignature;
    this.status = input.status ?? 'PENDING';
    this.source = 'STUDENT_GENERATED';
    this.createdBy = new ObjectId(input.createdBy);
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.isDeleted = false;
    this.screening = input.screening;
    if (input.rejectionReason) this.rejectionReason = input.rejectionReason;
    // Peer-validation counters only apply to a live PENDING question.
    if (this.status === 'PENDING') {
      this.gateState = 'COLLECTING';
      this.responseCount = 0;
      this.correctCount = 0;
      this.thumbsUpCount = 0;
      this.thumbsDownCount = 0;
    }
  }
}
