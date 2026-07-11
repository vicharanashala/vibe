export type AssessmentQuestionType = 'MCQ' | 'TRUE_FALSE' | 'MULTIPLE_RESPONSE' | 'DRAG_AND_DROP' | 'DROPDOWN_BLANK';

export interface AssessmentQuestion {
  id: string;
  type: AssessmentQuestionType;
  questionText: string;
  content: {
    options?: string[];
    correctAnswers?: Array<string | number | boolean>;
    dragItems?: string[];
    dropdownOptions?: Record<string, string[]>;
  };
}

export interface AssessmentQuestionDraft extends AssessmentQuestion {
  validationMessage?: string;
}
