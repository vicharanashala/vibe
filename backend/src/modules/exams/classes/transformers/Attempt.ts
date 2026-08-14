import 'reflect-metadata';
import { ObjectId } from 'mongodb';
import { IExamQuestion } from './Exam.js';

/**
 * One response the client submitted for a single question. Shape is designed
 * (not dictated by the legacy localStorage store) to be the minimal
 * information the server needs to independently regrade the attempt:
 * - MCQ/MSQ: `selectedOptionIds` — the option id(s) the student picked.
 * - NAT: `natValue` — the raw string the student typed.
 */
export interface IAttemptResponse {
    questionId: string;
    selectedOptionIds?: string[];
    natValue?: string;
    /** Pass-through UI bookkeeping from the client; not used in scoring. */
    isMarkedForReview?: boolean;
    isAnswered?: boolean;
    visited?: boolean;
}

export interface IAttemptAnswerEntry {
    correct: string[] | string;
}

/**
 * One client-reported proctoring violation/observation during an attempt
 * (e.g. `no-face`, `multiple-faces`, `tab-switch`). Purely an audit trail —
 * stored as-is and never consulted by `AttemptService.submitAttempt` when
 * computing `score`/`correctCount`.
 */
export interface IAttemptProctoringEvent {
    type: string;
    at: number;
    /**
     * Optional base64 data URL screenshot captured client-side at the moment
     * of the violation. Purely an audit trail, same as the rest of this
     * shape — stored as-is, never validated/parsed server-side.
     */
    imageDataUrl?: string;
}

/**
 * Mongo document shape for the `examAttempts` collection. `questions` is a
 * snapshot of `exam.questions` at submit time (so a later edit to the exam
 * cannot retroactively change what a past attempt was graded against), and
 * `answers`/`score`/`correctCount` are computed server-side by
 * `AttemptService.submitAttempt` — never trusted from the client.
 */
export interface IExamAttempt {
    _id?: ObjectId;
    examId: string;
    examTitle: string;
    /** Firebase uid / `user._id.toString()` of the student — same identity field as IExam.createdBy. */
    studentId: string;
    /** Snapshotted from the submitting user at attempt time (same rationale as examTitle) — so a teacher reviewing attempts sees a name/email, not just a raw id. */
    studentName?: string;
    studentEmail?: string;
    responses: IAttemptResponse[];
    questions: IExamQuestion[];
    answers: Record<string, IAttemptAnswerEntry>;
    score: number;
    totalMarks: number;
    correctCount: number;
    total: number;
    revealAnswers: boolean;
    tabSwitches?: number;
    startedAt?: number;
    /** Client-reported proctoring violation events, passed through unvalidated/unscored. */
    proctoringEvents?: IAttemptProctoringEvent[];
    submittedAt: number;
}
