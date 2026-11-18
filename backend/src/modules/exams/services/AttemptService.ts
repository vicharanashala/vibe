import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import { ForbiddenError, NotFoundError } from 'routing-controllers';
import { EXAMS_TYPES } from '../types.js';
import { ExamRepository } from '../repositories/providers/mongodb/ExamRepository.js';
import { AttemptRepository, DuplicateAttemptError } from '../repositories/providers/mongodb/AttemptRepository.js';
import { AttemptStartRepository } from '../repositories/providers/mongodb/AttemptStartRepository.js';
import { ExamService } from './ExamService.js';
import { ExamImageStorageService } from './ExamImageStorageService.js';
import { IExamQuestion } from '../classes/transformers/Exam.js';
import {
    IAttemptAnswerEntry,
    IAttemptProctoringEvent,
    IExamAttempt,
} from '../classes/transformers/Attempt.js';
import { ResponseItemBody } from '../classes/validators/AttemptValidators.js';
import { computeNegativeMarks } from '../utils/computeNegativeMarks.js';
import { IUser } from '#root/shared/interfaces/models.js';

/**
 * Slack added on top of `exam.duration` when checking the submission
 * deadline server-side, to absorb the auto-submit request's own network
 * latency and client/server clock skew — not meant to give real extra time.
 */
const SUBMIT_GRACE_MS = 2 * 60_000;

@injectable()
export class AttemptService {
    constructor(
        @inject(EXAMS_TYPES.ExamRepo)
        private readonly examRepo: ExamRepository,
        @inject(EXAMS_TYPES.AttemptRepo)
        private readonly attemptRepo: AttemptRepository,
        @inject(EXAMS_TYPES.AttemptStartRepo)
        private readonly attemptStartRepo: AttemptStartRepository,
        @inject(EXAMS_TYPES.ExamImageStorageService)
        private readonly examImageStorageService: ExamImageStorageService,
        @inject(EXAMS_TYPES.ExamService)
        private readonly examService: ExamService,
    ) {}

    /**
     * Stamps (or returns the already-stamped) server-side start time for
     * this student's attempt at this exam. Called once by the client right
     * before the timed attempt begins — `submitAttempt` enforces the
     * duration deadline against this value instead of any client-reported
     * timestamp, since a client that can stop its own countdown (devtools)
     * can just as easily report a fresh `startedAt` at submit time. Safe to
     * call more than once (e.g. on a page refresh mid-attempt): idempotent,
     * always returns the original timestamp, never resets it.
     */
    async startAttempt(examId: string, student: IUser): Promise<{ startedAt: number }> {
        const studentId = student._id!.toString();
        const exam = await this.examService.getExamForAttempt(examId, student);

        const now = Date.now();
        if (exam.opensAt != null && now < exam.opensAt) {
            throw new ForbiddenError('This exam is not open yet');
        }
        if (exam.closesAt != null && now > exam.closesAt) {
            throw new ForbiddenError('This exam is now closed');
        }

        const startedAt = await this.attemptStartRepo.getOrCreate(examId, studentId);
        return { startedAt };
    }

    /**
     * Loads the exam, independently regrades the submission against the
     * exam's own stored questions/correctOptions (never trusting a
     * client-submitted score), and persists the attempt. Mirrors the scoring
     * logic in `frontend/src/app/pages/exam/ExamPage.jsx`'s `handleSubmit`
     * (via `computeNegativeMarks`, ported in `utils/computeNegativeMarks.ts`)
     * so the persisted score matches what the exam-taking UI showed live.
     */
    async submitAttempt(
        examId: string,
        student: IUser,
        responses: ResponseItemBody[],
        meta: {
            tabSwitches?: number;
            startedAt?: number;
            proctoringEvents?: IAttemptProctoringEvent[];
        },
    ): Promise<IExamAttempt> {
        const studentId = student._id!.toString();
        const studentName =
            `${student.firstName || ''} ${student.lastName || ''}`.trim() || undefined;
        const studentEmail = student.email;

        // `getExamForAttempt` (not a plain `examRepo.findById`) so a student
        // who isn't eligible for this exam — or where it isn't published yet
        // — can't score a real attempt just by knowing/guessing the exam id.
        // Mirrors the eligibility gate `getExamForUser` already enforces on
        // the read path (`GET /exams/:examId`), plus an explicit `published`
        // check on top.
        const exam = await this.examService.getExamForAttempt(examId, student);

        const now = Date.now();
        // `!= null` (loose) on purpose — catches both `undefined` (field
        // never set) AND `null` (field explicitly cleared by a PATCH, since
        // Mongo's $set stores exactly what it's given). A strict
        // `!== undefined` check here would treat a cleared closesAt as
        // "0", making `now > 0` always true — i.e. permanently closed
        // instead of unbounded.
        if (exam.opensAt != null && now < exam.opensAt) {
            throw new ForbiddenError('This exam is not open yet');
        }
        if (exam.closesAt != null && now > exam.closesAt) {
            throw new ForbiddenError('This exam is now closed');
        }

        // Duration is enforced against the server-recorded start time
        // (`AttemptStartRepository`, stamped by `startAttempt` the first
        // time this student began this exam) rather than the client-reported
        // `meta.startedAt` — a client that can disable its own countdown
        // (devtools, or just letting it drift while backgrounded) can just
        // as easily report a fresh `startedAt` at submit time, which would
        // defeat a check based on the request body alone. Requires the
        // client to have called `startAttempt` first; there is no fallback
        // to the client-supplied value.
        const startedAt = await this.attemptStartRepo.get(examId, studentId);
        if (!startedAt) {
            throw new ForbiddenError('Attempt was never started — call the start endpoint first');
        }
        const grantedMinutes = (exam.timeGrants ?? [])
            .filter(g => g.used && g.redeemedByStudentId === studentId)
            .reduce((sum, g) => sum + (Number(g.minutes) || 0), 0);
        const allowedMs =
            (Number(exam.duration) || 0) * 60_000 + grantedMinutes * 60_000 + SUBMIT_GRACE_MS;
        if (now - startedAt > allowedMs) {
            throw new ForbiddenError('The time allotted for this exam has expired');
        }

        // This read-then-insert check alone has a race: two concurrent
        // submissions can both read "no existing attempt" before either
        // insert lands. It stays as a fast, friendly rejection for the
        // common case; the `noRetakesLock` unique index set on the attempt
        // below (see `AttemptRepository`) is what actually closes the race —
        // `create` throws `DuplicateAttemptError`, caught further down, if a
        // concurrent request won it instead.
        if (exam.allowRetakes === false) {
            const existingAttempt = await this.attemptRepo.findByExamAndStudent(examId, studentId);
            if (existingAttempt) {
                throw new ForbiddenError('You have already attempted this exam');
            }
        }

        const responseByQuestionId = new Map<string, ResponseItemBody>();
        for (const response of responses ?? []) {
            responseByQuestionId.set(response.questionId, response);
        }

        const answers: Record<string, IAttemptAnswerEntry> = {};
        let score = 0;
        let correctCount = 0;
        let totalMarks = 0;

        for (const question of exam.questions) {
            totalMarks += Number(question.marks) || 0;
            answers[question.id] = buildAnswerEntry(question);

            const response = responseByQuestionId.get(question.id);
            if (!response) continue;

            const neg = computeNegativeMarks(exam, question);

            if (question.type === 'NAT') {
                const natValue = (response.natValue || '').trim();
                const correct = question.correctOptions[0] ?? '';
                if (natValue === correct) {
                    score += Number(question.marks) || 0;
                    correctCount++;
                }
            } else if (question.type === 'MCQ') {
                const sel = (response.selectedOptionIds || [])[0];
                const correct = question.correctOptions[0];
                if (sel === correct) {
                    score += Number(question.marks) || 0;
                    correctCount++;
                } else if (sel) {
                    score -= neg;
                }
            } else if (question.type === 'MSQ') {
                const sel = [...(response.selectedOptionIds || [])].sort().join(',');
                const correct = [...question.correctOptions].sort().join(',');
                if (sel.length > 0 && sel === correct) {
                    score += Number(question.marks) || 0;
                    correctCount++;
                } else if (sel.length > 0) {
                    score -= neg;
                }
            }
        }

        score = Math.max(0, Number(score.toFixed(2)));

        // Proctoring snapshots: upload-if-base64, storing only the durable GCS
        // object path (see ExamImageStorageService class doc). Unlike question
        // images, a broken upload here must never block the student's
        // submission — resolveUploadForProctoringImage logs and drops just the
        // one offending snapshot instead of throwing.
        const proctoringPathPrefix = `exams/${examId}/attempts/${studentId}/proctoring`;
        const proctoringEvents = meta.proctoringEvents
            ? await Promise.all(
                  meta.proctoringEvents.map(async event => ({
                      ...event,
                      imageDataUrl: await this.examImageStorageService.resolveUploadForProctoringImage(
                          event.imageDataUrl,
                          proctoringPathPrefix,
                      ),
                  })),
              )
            : undefined;

        const attempt: IExamAttempt = {
            examId,
            examTitle: exam.title,
            studentId,
            studentName,
            studentEmail,
            responses: responses ?? [],
            questions: exam.questions,
            answers,
            score,
            totalMarks,
            correctCount,
            total: exam.questions.length,
            revealAnswers: exam.revealAnswers ?? false,
            tabSwitches: meta.tabSwitches,
            startedAt,
            // Audit trail only — passed through as-is, never consulted above
            // when computing score/correctCount.
            proctoringEvents,
            submittedAt: Date.now(),
            ...(exam.allowRetakes === false ? { noRetakesLock: true as const } : {}),
        };

        let created: IExamAttempt;
        try {
            created = await this.attemptRepo.create(attempt);
        } catch (error) {
            if (error instanceof DuplicateAttemptError) {
                throw new ForbiddenError('You have already attempted this exam');
            }
            throw error;
        }
        // Clears the server-recorded start time so a retake (allowRetakes:
        // true) gets a fresh one on its next `/start` call instead of
        // inheriting this attempt's — see AttemptStartRepository.delete.
        await this.attemptStartRepo.delete(examId, studentId);
        const resolved = await this.examImageStorageService.resolveAttemptImages(created);
        // The stored/persisted document keeps the real correctOptions (the
        // exam owner needs them to grade/review) — only the copy handed
        // straight back to the submitting student here is redacted, same
        // rule as `getById`/`listByStudent`.
        return redactAnswersIfHidden(resolved);
    }

    async listByStudent(studentId: string): Promise<IExamAttempt[]> {
        const attempts = await this.examImageStorageService.resolveAttemptsImages(
            await this.attemptRepo.findByStudent(studentId),
        );
        // "My attempts" is always a student viewing their own submissions, so
        // every entry here is subject to its own `revealAnswers` snapshot —
        // unlike `getById`, there's no owner/admin viewer to special-case.
        return attempts.map(a => redactAnswersIfHidden(a));
    }

    async getById(attemptId: string, user: IUser): Promise<IExamAttempt> {
        const attempt = await this.attemptRepo.findById(attemptId);
        if (!attempt) {
            throw new NotFoundError('Attempt not found');
        }

        const userId = user._id?.toString();
        const isOwnAttempt = attempt.studentId === userId;
        const isAdmin = user.roles === 'admin';

        if (!isOwnAttempt && !isAdmin) {
            const exam = await this.examRepo.findById(attempt.examId);
            const isExamOwner = exam?.createdBy === userId;
            if (!isExamOwner) {
                throw new ForbiddenError('You do not have access to this attempt');
            }
        }

        const resolved = await this.examImageStorageService.resolveAttemptImages(attempt);
        // The student viewing their own attempt is subject to revealAnswers;
        // an admin (or the exam's owner, handled by the branch above) needs
        // the real correct answers to grade/review and is never redacted.
        return isOwnAttempt && !isAdmin ? redactAnswersIfHidden(resolved) : resolved;
    }

    /**
     * All attempts for an exam — teacher-facing, restricted to the exam's
     * owner or an admin. Mirrors the ownership check style used elsewhere in
     * this module (`ExamController`'s `assertOwnerOrAdmin`), just inlined
     * here since the exam has to be loaded via `examRepo` anyway to check
     * ownership before touching `attemptRepo`.
     */
    async listByExam(examId: string, requestingUser: IUser): Promise<IExamAttempt[]> {
        const exam = await this.examRepo.findById(examId);
        if (!exam) {
            throw new NotFoundError('Exam not found');
        }

        const userId = requestingUser._id?.toString();
        const isOwner = exam.createdBy === userId;
        const isAdmin = requestingUser.roles === 'admin';
        if (!isOwner && !isAdmin) {
            throw new ForbiddenError('You can only view attempts for your own exams');
        }

        return this.examImageStorageService.resolveAttemptsImages(
            await this.attemptRepo.findByExam(examId),
        );
    }
}

function buildAnswerEntry(question: IExamQuestion): IAttemptAnswerEntry {
    if (question.type === 'NAT') {
        return { correct: question.correctOptions[0] ?? '' };
    }
    return { correct: question.correctOptions };
}

/**
 * Strips correct-answer information from an attempt before it reaches the
 * student who submitted it, when the exam's `revealAnswers` setting (its
 * value at submit time, snapshotted onto the attempt) is off. Previously
 * `revealAnswers` was only consulted by the frontend to decide whether to
 * *display* the answer key — the full `correctOptions` were always present
 * in the API response regardless, so any student could read them straight
 * off `GET /exams/attempts/:attemptId` or `/attempts/mine` once they'd
 * submitted. `questions[].correctOptions` (a snapshot of the exam's own
 * question bank at submit time) leaks the same information as
 * `answers[].correct` and must be redacted too — as must `explanation`:
 * teachers routinely write it as "Correct answer: X, because..." (see
 * EditExamPage.jsx's own field label), so leaving it in place would hand
 * back the answer key through a side door even with correctOptions blanked.
 */
function redactAnswersIfHidden(attempt: IExamAttempt): IExamAttempt {
    if (attempt.revealAnswers) {
        return attempt;
    }
    return {
        ...attempt,
        questions: attempt.questions.map(q => ({ ...q, correctOptions: [], explanation: undefined })),
        answers: Object.fromEntries(
            Object.entries(attempt.answers).map(([questionId, entry]) => [
                questionId,
                { correct: Array.isArray(entry.correct) ? [] : '' },
            ]),
        ),
    };
}
