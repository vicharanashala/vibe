
// Enhanced question types based on backend QuestionRenderView
export interface QuizQuestion {
  id: string;
  type: 'SELECT_ONE_IN_LOT' | 'SELECT_MANY_IN_LOT' | 'NUMERIC_ANSWER_TYPE' | 'DESCRIPTIVE' | 'ORDER_THE_LOTS';
  question: string;
  options?: string[]; // For lot items
  points: number;
  timeLimit?: number; // in seconds (timeLimitSeconds from backend)
  hint?: string;
  // Additional properties for different question types
  decimalPrecision?: number;
  expression?: string;
  lotItems?: Array<{ text: string; explaination: string; _id: { buffer: { type: string; data: number[] } } | string }>;
}

export interface BufferLike {
  buffer: {
    type: string;
    data: number[];
  };
}

export interface questionBankRef {
  bankId: string; // ObjectId as string
  count: number; // How many questions to pick
  difficulty?: string[]; // Optional filter
  tags?: string[]; // Optional filter
  type?: string; // Optional question type filter
}

export interface QuizProps {
  questionBankRefs: questionBankRef[];
  passThreshold: number;
  maxAttempts: number;
  quizType: 'DEADLINE' | 'NO_DEADLINE' | '';
  releaseTime: Date | undefined;
  questionVisibility: number;
  deadline?: Date;
  approximateTimeToComplete: string;
  allowPartialGrading: boolean;
  allowHint: boolean;
  showCorrectAnswersAfterSubmission: boolean;
  showExplanationAfterSubmission: boolean;
  showScoreAfterSubmission: boolean;
  quizId: string | BufferLike;
  doGesture?: boolean;
  onNext?: () => void;
  onPrevVideo?: () => void;
  isProgressUpdating?: boolean;
  attemptId?: string;
  setAttemptId?: (attemptId: string) => void;
  displayNextLesson?: boolean;
  setQuizPassed?: (passed: number) => void; // Function to update quizPassed
}

export interface QuizRef {
  stopItem: () => void;
}

export interface BufferId {
  buffer: {
    type: "Buffer";
    data: number[];
  };
}

export interface LotItem {
  text: string; 
  _id: BufferId;
}

export interface BaseQuestionRenderView {
  _id: BufferId;
  type: string;
  isParameterized: boolean;
  text: string;
  hint: string;
  points: number;
  timeLimitSeconds: number;
  parameterMap: Record<string, unknown>;
}

export interface DescriptiveQuestionRenderView extends BaseQuestionRenderView {
  type: "DESCRIPTIVE";
}

export interface SelectManyInLotQuestionRenderView extends BaseQuestionRenderView {
  type: "SELECT_MANY_IN_LOT";
  lotItems: LotItem[];
}

export interface OrderTheLotsQuestionRenderView extends BaseQuestionRenderView {
  type: "ORDER_THE_LOTS";
  lotItems: LotItem[];
}

export interface NumericAnswerQuestionRenderView extends BaseQuestionRenderView {
  type: "NUMERIC_ANSWER_TYPE";
  decimalPrecision: number;
  expression: string;
}

export interface SelectOneInLotQuestionRenderView extends BaseQuestionRenderView {
  type: "SELECT_ONE_IN_LOT";
  lotItems: LotItem[];
}

export type QuestionRenderView = 
  | DescriptiveQuestionRenderView
  | SelectManyInLotQuestionRenderView
  | OrderTheLotsQuestionRenderView
  | NumericAnswerQuestionRenderView
  | SelectOneInLotQuestionRenderView;

 export type SaveQuestion = {
  questionId: string;
  questionType: "DESCRIPTIVE" | "SELECT_MANY_IN_LOT" | "ORDER_THE_LOTS" | "NUMERIC_ANSWER_TYPE" | "SELECT_ONE_IN_LOT";
  answer: {
    lotItemId?: string;
    lotItemIds?: string[];
    text?: string;
    numericAnswer?: string;
    order?: string[];
  }
};

export interface IQuestionAnswerFeedback {
  questionId: string;
  status: 'CORRECT' | 'INCORRECT' | 'PARTIAL';
  score: number;
  answerFeedback?: string;
}

export interface SubmitQuizResponse {
  totalScore?: number;
  totalMaxScore?: number;
  overallFeedback?: IQuestionAnswerFeedback[];
  gradingStatus: 'PENDING' | 'PASSED' | 'FAILED';
  gradedAt?: string;
  gradedBy?: string;
}