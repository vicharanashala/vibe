import {ObjectId} from 'mongodb';

export type QuestionSource = 'INSTRUCTOR' | 'AI_GENERATED' | 'STUDENT_GENERATED';
export type QuestionReviewStatus = 'PENDING_REVIEW' | 'APPROVED';

type QuestionType =
  | 'SELECT_ONE_IN_LOT'
  | 'SELECT_MANY_IN_LOT'
  | 'ORDER_THE_LOTS'
  | 'NUMERIC_ANSWER_TYPE'
  | 'DESCRIPTIVE';

interface IQuestionParameter {
  name: string;
  possibleValues: string[];
  type: 'number' | 'string';
}

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
export type BloomLevel =
  | 'knowledge'
  | 'understanding'
  | 'application'
  | 'analysis'
  | 'evaluation'
  | 'creation'
  | 'unclassified';

interface IQuestion {
  _id?: string | ObjectId;
  text: string;
  type: QuestionType;
  isParameterized: boolean;
  bloomLevel?: BloomLevel;
  parameters?: IQuestionParameter[];
  hint?: string;
  timeLimitSeconds: number;
  points?: number;
  priority: Priority;
  source?: QuestionSource;
  reviewStatus?: QuestionReviewStatus;
  studentQuestionId?: string | ObjectId;
}

interface INATSolution {
  decimalPrecision: number;
  upperLimit: number;
  lowerLimit: number;
  value?: number;
  expression?: string;
}

interface IDESSolution {
  solutionText: string;
}

interface ILotItem {
  _id?: string | ObjectId;
  text: string;
  explaination: string;
}

interface ILotOrder {
  lotItem: ILotItem;
  order: number;
}

interface IOTLSolution {
  ordering: ILotOrder[];
}

interface ISOLSolution {
  incorrectLotItems: ILotItem[];
  correctLotItem: ILotItem;
}

interface ISMLSolution {
  incorrectLotItems: ILotItem[];
  correctLotItems: ILotItem[];
}

type ID = string | ObjectId;

interface IQuestionBank {
  _id?: string | ObjectId;
  courseId?: ID;
  courseVersionId?: ID;
  questions: ID[];
  tags?: string[];
  title: string;
  description: string;
  points?: number;
  createdAt: Date;
  updatedAt: Date;
  // Crowd-sourced "Submitted – Pending Validation" staging bank (see
  // studentQuestions/CROWD_QUESTION_BANK.md). When true, this bank holds
  // student-submitted questions awaiting peer validation + instructor approval
  // and is NOT referenced by the live quiz's questionBankRefs, so it never
  // affects graded quiz draws. Keyed to the quiz it belongs to via
  // sourceGradedBankId (the quiz's graded questionBankRefs[0].bankId).
  crowdSubmitted?: boolean;
  sourceGradedBankId?: ID;
  sourceQuizId?: ID;
  isDeleted?: boolean;
  deletedAt?: Date;
}

type QuestionQuizView = Omit<IQuestion, 'hint'>;

interface ISOLQuizView extends QuestionQuizView {
  lot: ILotItem[];
}

interface ISMLQuizView extends QuestionQuizView {
  lot: ILotItem[];
}

interface IOTLQuizView extends QuestionQuizView {
  lot: ILotItem[];
}

type INATQuizView = QuestionQuizView;

type IDESQuizView = QuestionQuizView;

export {
  IQuestion,
  IQuestionParameter,
  ISOLSolution,
  ISMLSolution,
  IOTLSolution,
  INATSolution,
  IDESSolution,
  ILotItem,
  ILotOrder,
  IQuestionBank,
  ISOLQuizView,
  ISMLQuizView,
  IOTLQuizView,
  INATQuizView,
  IDESQuizView,
  QuestionType,
  QuestionQuizView,
};
