// Namespaced with an 'Exams.' prefix — `Symbol.for` is a global registry
// keyed by string, and the quizzes module (`quizzes/types.ts`) already
// registers *different* classes under several of the same bare names
// (AttemptService, AttemptRepo, QuestionBankService, QuestionBankRepo — this
// module reuses quiz-domain terminology). Sharing a bare Symbol.for key made
// the combined "all"-mode container see two distinct singleton bindings
// under the identical token, so resolving it — inc. transitively, e.g.
// CourseRepository pulling in quizzes' QuestionBankRepo — threw "Ambiguous
// bindings found for service". Every key here is namespaced, not just the
// ones already caught colliding, so this class of bug can't resurface as
// more exams/quizzes symbols happen to line up.
const TYPES = {
    // Services
    ExamService: Symbol.for('Exams.ExamService'),
    AttemptService: Symbol.for('Exams.AttemptService'),
    ExamImageStorageService: Symbol.for('Exams.ExamImageStorageService'),
    QuestionBankService: Symbol.for('Exams.QuestionBankService'),

    // Repositories
    ExamRepo: Symbol.for('Exams.ExamRepo'),
    AttemptRepo: Symbol.for('Exams.AttemptRepo'),
    QuestionBankRepo: Symbol.for('Exams.QuestionBankRepo'),
};

export { TYPES as EXAMS_TYPES };
