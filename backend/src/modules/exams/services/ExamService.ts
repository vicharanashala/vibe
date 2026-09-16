import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { injectable, inject } from 'inversify';
import { NotFoundError, ForbiddenError } from 'routing-controllers';
import { ObjectId } from 'mongodb';
import { EXAMS_TYPES } from '../types.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { EnrollmentRepository } from '#root/shared/index.js';
import { IUser } from '#root/shared/interfaces/models.js';
import { ExamRepository } from '../repositories/providers/mongodb/ExamRepository.js';
import { ExamImageStorageService } from './ExamImageStorageService.js';
import {
    IExam,
    IExamEligibility,
    IExamQuestion,
    IExamQuestionOption,
    INegativeMarkingScheme,
    ITimeGrant,
} from '../classes/transformers/Exam.js';
import {
    AddQuestionBody,
    AddTimeGrantBody,
    CreateExamBody,
    UpdateExamBody,
    UpdateQuestionBody,
} from '../classes/validators/ExamValidators.js';

const DEFAULT_NEGATIVE_MARKING_SCHEME: INegativeMarkingScheme = {
    MCQ: 'one_third',
    MSQ: 'none',
    NAT: 'none',
};

/** No 0/O or 1/I, to avoid ambiguity when a student reads a code aloud/types it. */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateGrantCode(): string {
    let s = '';
    for (let i = 0; i < 6; i++) {
        s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    return s;
}

@injectable()
export class ExamService {
    constructor(
        @inject(EXAMS_TYPES.ExamRepo)
        private readonly examRepo: ExamRepository,
        @inject(EXAMS_TYPES.ExamImageStorageService)
        private readonly examImageStorageService: ExamImageStorageService,
        @inject(GLOBAL_TYPES.EnrollmentRepo)
        private readonly enrollmentRepo: EnrollmentRepository,
    ) {}

    async createExam(body: CreateExamBody, createdBy: string): Promise<IExam> {
        const now = Date.now();
        const timeGrants: ITimeGrant[] = (body.timeGrants ?? []).map(seed => ({
            id: `grant-${randomUUID()}`,
            code: generateGrantCode(),
            minutes: Number(seed.minutes) || 0,
            note: seed.note || '',
            used: false,
            usedAt: null,
            createdAt: now,
        }));

        const exam: IExam = {
            title: body.title,
            duration: body.duration ?? 30,
            passingMarks: body.passingMarks ?? 0,
            negativeMarking: body.negativeMarking ?? true,
            negativeMarkingScheme: (body.negativeMarkingScheme as INegativeMarkingScheme) ?? {
                ...DEFAULT_NEGATIVE_MARKING_SCHEME,
            },
            instructions: body.instructions ?? '',
            published: false,
            revealAnswers: body.revealAnswers ?? false,
            proctoring: body.proctoring,
            opensAt: body.opensAt,
            closesAt: body.closesAt,
            allowRetakes: body.allowRetakes ?? true,
            eligibility: body.eligibility as IExamEligibility | undefined,
            createdBy,
            createdAt: now,
            updatedAt: now,
            questions: [],
            timeGrants,
        };

        // Exams start with no questions (added afterwards via addQuestion), so
        // there is no image field to resolve here — createExam can never carry a
        // question/option image directly. Still routed through
        // resolveExamImages for consistency with every other method that
        // returns an IExam to a controller; it is a no-op on an empty array.
        return this.examImageStorageService.resolveExamImages(await this.examRepo.create(exam));
    }

    async getExamById(examId: string): Promise<IExam> {
        const exam = await this.examRepo.findById(examId);
        if (!exam) {
            throw new NotFoundError('Exam not found');
        }
        return this.examImageStorageService.resolveExamImages(exam);
    }

    /**
     * Owner/admin get unrestricted access (same as `getExamById`); any other
     * authenticated user must clear `isEligibleForStudent` or gets a 403.
     * Used by the student-facing `GET /exams/:examId` route so a student
     * cannot bypass the `eligibility` gate just by knowing/guessing the id —
     * `findPublished` filtering alone only hides the exam from the list.
     */
    async getExamForUser(examId: string, user: IUser): Promise<IExam> {
        const exam = await this.getExamById(examId);
        if (exam.createdBy === user._id?.toString() || user.roles === 'admin') {
            return exam;
        }
        if (!(await this.isEligibleForStudent(exam, user))) {
            throw new ForbiddenError('You are not eligible to view this exam');
        }
        return exam;
    }

    async findByCreator(uid: string): Promise<IExam[]> {
        return this.examImageStorageService.resolveExamsImages(await this.examRepo.findByCreator(uid));
    }

    /**
     * Published exams for the student-facing list. Admins see every
     * published exam regardless of `eligibility`; everyone else only sees
     * the ones they clear — which now requires an admin to have explicitly
     * set an `eligibility` rule (even "Everyone") at all. An exam nobody has
     * configured visibility for yet is not visible to students.
     */
    async findPublished(user: IUser): Promise<IExam[]> {
        const exams = await this.examImageStorageService.resolveExamsImages(await this.examRepo.findPublished());
        if (user.roles === 'admin') {
            return exams;
        }
        const eligibility = await Promise.all(exams.map(exam => this.isEligibleForStudent(exam, user)));
        return exams.filter((_, i) => eligibility[i]);
    }

    /**
     * Evaluates `exam.eligibility` for a non-owner, non-admin user.
     *
     * No `eligibility` set at all means nobody has decided who this exam is
     * for yet, so it defaults to hidden - published alone is not enough.
     * `mode: 'none'` is different: that's an admin having gone into "Who can
     * see this exam" and explicitly chosen "Everyone", which does open it up
     * to every student. (`{ eligibility: { mode: 'none' } }` is also the
     * documented way to clear an existing completion/manual restriction back
     * to open - see `ExamEligibilitySettings` on the frontend.)
     */
    private async isEligibleForStudent(exam: IExam, user: IUser): Promise<boolean> {
        const rule = exam.eligibility;
        if (!rule) {
            return false;
        }
        if (rule.mode === 'none') {
            return true;
        }

        if (rule.mode === 'manual') {
            const email = (user.email || '').toLowerCase();
            return (rule.allowedEmails ?? []).some(e => e.toLowerCase() === email);
        }

        // mode === 'completion'. Both fields are required by
        // ExamEligibilityBody for this mode, but fail closed (not open) if a
        // legacy/malformed document somehow lacks one — an admin who set up
        // a restriction almost certainly intended it to restrict, not to
        // silently pass everyone through.
        if (!rule.courseId || rule.minCompletionPercent == null) {
            return false;
        }

        const userId = user._id!.toString();
        const enrollments = await this.enrollmentRepo.findEnrollments({
            userId: { $in: [userId, new ObjectId(userId)] },
            courseId: { $in: [rule.courseId, new ObjectId(rule.courseId)] },
            ...(rule.courseVersionId
                ? { courseVersionId: { $in: [rule.courseVersionId, new ObjectId(rule.courseVersionId)] } }
                : {}),
            role: 'STUDENT',
            isDeleted: { $ne: true },
        });

        return enrollments.some(e => (e.percentCompleted ?? 0) >= rule.minCompletionPercent!);
    }

    async updateExam(examId: string, patch: UpdateExamBody): Promise<IExam> {
        await this.getExamById(examId);
        const updated = await this.examRepo.update(examId, patch as Partial<IExam>);
        if (!updated) {
            throw new NotFoundError('Exam not found');
        }
        return this.examImageStorageService.resolveExamImages(updated);
    }

    async deleteExam(examId: string): Promise<void> {
        await this.getExamById(examId);
        await this.examRepo.delete(examId);
    }

    /**
     * Builds a fully-formed `IExamQuestion` from a client-submitted
     * `AddQuestionBody`, routing any embedded image through
     * `ExamImageStorageService` (upload-if-base64, storing only the durable
     * GCS object path — see that class's doc). Extracted out of `addQuestion`
     * so `addQuestionsBulk` (CSV import) can reuse the exact same
     * image-resolution code path instead of duplicating it — a failed upload
     * still propagates (InternalServerError) for both callers, same as
     * before this was split out.
     */
    private async buildQuestion(examId: string, questionId: string, body: AddQuestionBody): Promise<IExamQuestion> {
        const pathPrefix = `exams/${examId}/questions/${questionId}`;
        const [questionImage, options] = await Promise.all([
            this.examImageStorageService.resolveUploadForQuestionImage(body.questionImage, pathPrefix),
            Promise.all(
                (body.options ?? []).map(async (o): Promise<IExamQuestionOption> => ({
                    id: o.id,
                    text: o.text ?? '',
                    image: await this.examImageStorageService.resolveUploadForQuestionImage(
                        o.image,
                        `${pathPrefix}/options/${o.id}`,
                    ),
                })),
            ),
        ]);

        return {
            id: questionId,
            type: body.type,
            questionText: body.questionText,
            questionImage,
            options,
            correctOptions: body.correctOptions,
            marks: body.marks,
            negativeMarks: body.negativeMarks ?? 0,
            useCustomNegative: body.useCustomNegative ?? false,
            natAnswerType: body.natAnswerType,
            explanation: body.explanation,
            topic: body.topic,
        };
    }

    async addQuestion(examId: string, body: AddQuestionBody): Promise<IExam> {
        await this.getExamById(examId);
        const question = await this.buildQuestion(examId, `q-${randomUUID()}`, body);

        const updated = await this.examRepo.addQuestion(examId, question);
        if (!updated) {
            throw new NotFoundError('Exam not found');
        }
        return this.examImageStorageService.resolveExamImages(updated);
    }

    /**
     * Bulk form of `addQuestion` (CSV import): builds every question via the
     * same `buildQuestion` path (so embedded images are still resolved
     * consistently), then appends them all to `exam.questions` in a single
     * Mongo update via `ExamRepository.addQuestionsBulk` rather than N
     * sequential single-question writes.
     */
    async addQuestionsBulk(examId: string, bodies: AddQuestionBody[]): Promise<IExam> {
        if (bodies.length === 0) {
            // No-op: skip the write entirely rather than bumping updatedAt for
            // nothing.
            return this.getExamById(examId);
        }
        await this.getExamById(examId);
        const questions = await Promise.all(
            bodies.map(body => this.buildQuestion(examId, `q-${randomUUID()}`, body)),
        );

        const updated = await this.examRepo.addQuestionsBulk(examId, questions);
        if (!updated) {
            throw new NotFoundError('Exam not found');
        }
        return this.examImageStorageService.resolveExamImages(updated);
    }

    /**
     * Appends already-built `IExamQuestion`s to an exam in a single update.
     * Unlike `addQuestion`/`addQuestionsBulk`, this does NOT route images
     * through `ExamImageStorageService` — its one caller,
     * `QuestionBankService.addToExam`, copies questions whose image fields
     * are already durable GCS object paths (persisted that way when the bank
     * entry was created), not base64 data URLs, so there is nothing to
     * upload.
     */
    async appendQuestions(examId: string, questions: IExamQuestion[]): Promise<IExam> {
        if (questions.length === 0) {
            return this.getExamById(examId);
        }
        await this.getExamById(examId);
        const updated = await this.examRepo.addQuestionsBulk(examId, questions);
        if (!updated) {
            throw new NotFoundError('Exam not found');
        }
        return this.examImageStorageService.resolveExamImages(updated);
    }

    async updateQuestion(
        examId: string,
        questionId: string,
        patch: UpdateQuestionBody,
    ): Promise<IExam> {
        const exam = await this.getExamById(examId);
        if (!exam.questions.some(q => q.id === questionId)) {
            throw new NotFoundError('Question not found');
        }

        // Only touch the image fields the client actually sent (IsOptional —
        // absence means "don't change"). `EditExamPage.jsx` resends the
        // question's current (already-resolved, signed-URL) image on every
        // save whether or not it changed, so resolveUploadForQuestionImage
        // also has to round-trip our own signed URLs back to the durable
        // object path rather than persisting them verbatim.
        const resolvedPatch: Partial<IExamQuestion> = { ...patch } as Partial<IExamQuestion>;
        const pathPrefix = `exams/${examId}/questions/${questionId}`;

        if (patch.questionImage !== undefined) {
            resolvedPatch.questionImage = await this.examImageStorageService.resolveUploadForQuestionImage(
                patch.questionImage,
                pathPrefix,
            );
        }
        if (patch.options !== undefined) {
            resolvedPatch.options = await Promise.all(
                patch.options.map(async (o): Promise<IExamQuestionOption> => ({
                    id: o.id,
                    text: o.text ?? '',
                    image: await this.examImageStorageService.resolveUploadForQuestionImage(
                        o.image,
                        `${pathPrefix}/options/${o.id}`,
                    ),
                })),
            );
        }

        const updated = await this.examRepo.updateQuestion(examId, questionId, resolvedPatch);
        if (!updated) {
            throw new NotFoundError('Question not found');
        }
        return this.examImageStorageService.resolveExamImages(updated);
    }

    async removeQuestion(examId: string, questionId: string): Promise<IExam> {
        const exam = await this.getExamById(examId);
        if (!exam.questions.some(q => q.id === questionId)) {
            throw new NotFoundError('Question not found');
        }

        const updated = await this.examRepo.removeQuestion(examId, questionId);
        if (!updated) {
            throw new NotFoundError('Exam not found');
        }
        return this.examImageStorageService.resolveExamImages(updated);
    }

    async addTimeGrant(examId: string, body: AddTimeGrantBody): Promise<IExam> {
        await this.getExamById(examId);
        const grant: ITimeGrant = {
            id: `grant-${randomUUID()}`,
            code: generateGrantCode(),
            minutes: Number(body.minutes) || 0,
            note: body.note || '',
            used: false,
            usedAt: null,
            createdAt: Date.now(),
        };

        const updated = await this.examRepo.addTimeGrant(examId, grant);
        if (!updated) {
            throw new NotFoundError('Exam not found');
        }
        return this.examImageStorageService.resolveExamImages(updated);
    }

    async removeTimeGrant(examId: string, grantId: string): Promise<IExam> {
        const exam = await this.getExamById(examId);
        if (!(exam.timeGrants ?? []).some(g => g.id === grantId)) {
            throw new NotFoundError('Time grant not found');
        }

        const updated = await this.examRepo.removeTimeGrant(examId, grantId);
        if (!updated) {
            throw new NotFoundError('Exam not found');
        }
        return this.examImageStorageService.resolveExamImages(updated);
    }

    /**
     * Mirrors `examStore.redeemTimeGrant` from the legacy localStorage store:
     * any authenticated user (not just the exam owner) can redeem a code, and
     * failures are returned as a result object rather than thrown, since an
     * invalid/used code is an expected user-facing outcome, not a server error.
     */
    async redeemTimeGrant(
        examId: string,
        rawCode: string,
    ): Promise<{ ok: boolean; minutes?: number; error?: string }> {
        const exam = await this.getExamById(examId);
        const code = (rawCode || '').trim().toUpperCase();
        if (!code) {
            return { ok: false, error: 'Enter a code' };
        }

        const grant = (exam.timeGrants ?? []).find(g => g.code === code);
        if (!grant) {
            return { ok: false, error: 'Invalid code' };
        }
        if (grant.used) {
            return { ok: false, error: 'This code has already been used' };
        }

        const redeemed = await this.examRepo.markTimeGrantUsed(examId, grant.id);
        if (!redeemed) {
            // Lost a race with another redemption of the same code between the
            // read above and this write.
            return { ok: false, error: 'This code has already been used' };
        }

        return { ok: true, minutes: grant.minutes };
    }
}
