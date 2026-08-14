const TYPES = {
    // Services
    ExamService: Symbol.for('ExamService'),
    AttemptService: Symbol.for('AttemptService'),
    ExamImageStorageService: Symbol.for('ExamImageStorageService'),
    QuestionBankService: Symbol.for('QuestionBankService'),

    // Repositories
    ExamRepo: Symbol.for('ExamRepo'),
    AttemptRepo: Symbol.for('AttemptRepo'),
    QuestionBankRepo: Symbol.for('QuestionBankRepo'),
};

export { TYPES as EXAMS_TYPES };
