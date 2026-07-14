export type AssessmentQuestionType =
  | 'MCQ'
  | 'TRUE_FALSE'
  | 'MULTIPLE_RESPONSE'
  | 'DRAG_AND_DROP'
  | 'MATRIX_YES_NO'
  | 'DROPDOWN_BLANK';

/** Unified JSON schema for all five question types */
export interface AssessmentQuestion {
  id: string;
  type: AssessmentQuestionType;
  questionText: string;
  content: {
    // MCQ / Multiple Response
    options?: string[];
    correctAnswers?: Array<string | number | boolean>;
    // Drag-and-Drop
    items?: string[];
    targets?: Record<string, string>; // itemLabel -> targetLabel
    /** @deprecated use items — kept for backward compat */
    dragItems?: string[];
    // Matrix Yes/No
    statements?: string[];
    // Dropdown Fill-in-the-blanks
    sentence?: string;
    dropdownOptions?: Record<string, string[]>;
  };
}

export interface AssessmentQuestionDraft extends AssessmentQuestion {
  validationMessage?: string;
}
