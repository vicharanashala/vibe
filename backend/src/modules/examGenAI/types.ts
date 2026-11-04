// Namespaced with an 'ExamGenAI.' prefix — see exams/types.ts for why bare
// Symbol.for(...) keys are unsafe across modules in this codebase (two
// distinct classes registered under the same global symbol throws "Ambiguous
// bindings found for service" when both modules load in APP_MODULE=all).
const TYPES = {
    // Repositories
    AiApiLogRepo: Symbol.for('ExamGenAI.AiApiLogRepo'),
    GeneratedQuestionRepo: Symbol.for('ExamGenAI.GeneratedQuestionRepo'),

    // Services
    LlmClient: Symbol.for('ExamGenAI.LlmClient'),
    QuestionGenerationService: Symbol.for('ExamGenAI.QuestionGenerationService'),
    SseService: Symbol.for('ExamGenAI.SseService'),
};

export { TYPES as EXAM_GENAI_TYPES };
