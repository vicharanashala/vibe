import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import { ForbiddenError, NotFoundError } from 'routing-controllers';
import { EXAMS_TYPES } from '../types.js';
import { ExamRepository } from '../repositories/providers/mongodb/ExamRepository.js';
import { AttemptRepository } from '../repositories/providers/mongodb/AttemptRepository.js';
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

@injectable()
export class AttemptService {
    constructor(
        @inject(EXAMS_TYPES.ExamRepo)
        private readonly examRepo: ExamRepository,
        @inject(EXAMS_TYPES.AttemptRepo)
        private readonly attemptRepo: AttemptRepository,
        @inject(EXAMS_TYPES.ExamImageStorageService)
        private readonly examImageStorageService: ExamImageStorageService,
    ) {}

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

        const exam = await this.examRepo.findById(examId);
        if (!exam) {
            throw new NotFoundError('Exam not found');
        }

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
            startedAt: meta.startedAt,
            // Audit trail only — passed through as-is, never consulted above
            // when computing score/correctCount.
            proctoringEvents,
            submittedAt: Date.now(),
        };

        const created = await this.attemptRepo.create(attempt);
        return this.examImageStorageService.resolveAttemptImages(created);
    }

    async listByStudent(studentId: string): Promise<IExamAttempt[]> {
        return this.examImageStorageService.resolveAttemptsImages(
            await this.attemptRepo.findByStudent(studentId),
        );
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

        return this.examImageStorageService.resolveAttemptImages(attempt);
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
