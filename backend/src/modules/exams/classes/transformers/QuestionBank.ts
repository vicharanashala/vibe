import 'reflect-metadata';
import { ObjectId } from 'mongodb';
import { IExamQuestion } from './Exam.js';

/**
 * Mongo document shape for the `questionBank` collection — a teacher-owned,
 * exam-independent library of reusable questions. Extends `IExamQuestion`
 * (same `id`/`type`/`questionText`/`options`/`correctOptions`/`marks`/
 * `negativeMarks`/`useCustomNegative`/`natAnswerType`/`explanation`/`topic`
 * fields, so a bank entry already has the exact shape needed to become an
 * exam question) with ownership/audit fields, mirroring `IExam`'s
 * `createdBy`/`createdAt`/`updatedAt`.
 *
 * The inherited `id` here is a bank-scoped id (`bank-<uuid>`, assigned in
 * `QuestionBankService.addToBank`) and is NEVER reused as the `id` of a
 * question copied into an exam — see `QuestionBankService.addToExam`, which
 * assigns a fresh `q-<uuid>` per copy so bank entries and exam questions
 * never share an id namespace (editing one must not retroactively mutate
 * the other). `_id` is the Mongo document id, used by
 * `QuestionBankRepository`/`QuestionBankController` for find/delete —
 * analogous to how `IExam._id` is distinct from the ids of its embedded
 * `questions[]`.
 */
export interface IQuestionBankEntry extends IExamQuestion {
    _id?: ObjectId;
    /** Firebase uid / `user._id.toString()` of the creator — same identity field as `IExam.createdBy`. */
    createdBy: string;
    createdAt: number;
    updatedAt: number;
}
