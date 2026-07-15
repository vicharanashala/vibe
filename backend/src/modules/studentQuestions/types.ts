const STUDENT_QUESTION_TYPES = {
  StudentQuestionService: Symbol.for('StudentQuestionService'),
  StudentQuestionRepo: Symbol.for('StudentQuestionRepo'),
  ScreeningService: Symbol.for('ScreeningService'),
  VectorDedupService: Symbol.for('VectorDedupService'),
  QuestionVectorRepo: Symbol.for('QuestionVectorRepo'),
};

export { STUDENT_QUESTION_TYPES };
