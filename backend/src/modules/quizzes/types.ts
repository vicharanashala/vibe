const TYPES = {
  //Controllers
  QuestionController: Symbol.for('QuestionController'),

  //Services
  QuestionService: Symbol.for('QuestionService'),
  AttemptService: Symbol.for('AttemptService'),
  QuestionBankService: Symbol.for('QuestionBankService'),
  QuizService: Symbol.for('QuizService'),

  //Repositories
  QuestionRepo: Symbol.for('QuestionRepo'),
  QuestionBankRepo: Symbol.for('QuestionBankRepo'),
  QuizRepo: Symbol.for('QuizRepo'),
  AttemptRepo: Symbol.for('AttemptRepo'),
  SubmissionRepo: Symbol.for('SubmissionRepo'),
  UserQuizMetricsRepo: Symbol.for('UserQuizMetricsRepo'),
};

export {TYPES as QUIZZES_TYPES};
