import { IExam, IExamQuestion } from '../classes/transformers/Exam.js';

/**
 * Server-side port of `computeNegativeMarks` from
 * `frontend/src/lib/examStore.js`. Kept byte-for-byte equivalent so a score
 * persisted here always matches the "live" score the exam-taking UI shows,
 * down to the same `toFixed(4)` rounding for fractional schemes.
 */
export function computeNegativeMarks(
    exam: Pick<IExam, 'negativeMarkingScheme'>,
    question: Pick<IExamQuestion, 'type' | 'marks' | 'negativeMarks' | 'useCustomNegative'>,
): number {
    // Per-question override wins when explicitly enabled.
    if (question.useCustomNegative) {
        return Number(question.negativeMarks) || 0;
    }

    const scheme = exam.negativeMarkingScheme?.[question.type] ?? 'none';
    const m = Number(question.marks) || 0;

    switch (scheme) {
        case 'one_third':
            return +(m / 3).toFixed(4);
        case 'one_fourth':
            return +(m / 4).toFixed(4);
        case 'full':
            return m;
        case 'custom':
            return Number(question.negativeMarks) || 0;
        case 'none':
        default:
            return 0;
    }
}
