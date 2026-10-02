import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { injectable, inject } from 'inversify';
import { ForbiddenError, NotFoundError } from 'routing-controllers';
import { EXAMS_TYPES } from '../types.js';
import { QuestionBankRepository } from '../repositories/providers/mongodb/QuestionBankRepository.js';
import { ExamService } from './ExamService.js';
import { ExamImageStorageService } from './ExamImageStorageService.js';
import { IQuestionBankEntry } from '../classes/transformers/QuestionBank.js';
import { IExam, IExamQuestion, IExamQuestionOption } from '../classes/transformers/Exam.js';
import { AddQuestionBody } from '../classes/validators/ExamValidators.js';

@injectable()
export class QuestionBankService {
    constructor(
        @inject(EXAMS_TYPES.QuestionBankRepo)
        private readonly questionBankRepo: QuestionBankRepository,
        @inject(EXAMS_TYPES.ExamService)
        private readonly examService: ExamService,
        @inject(EXAMS_TYPES.ExamImageStorageService)
        private readonly examImageStorageService: ExamImageStorageService,
    ) {}

    /**
     * Adds a question to the caller's bank. Routes any embedded image
     * through `ExamImageStorageService` exactly like
     * `ExamService`'s question-building path — upload-if-base64, storing
     * only the durable GCS object path, under an
     * `exams/question-bank/<uid>/<bankId>` prefix (kept under the same
     * `exams/` bucket root as everything else `ExamImageStorageService`
     * manages, mirroring `exams/<examId>/questions/<questionId>`).
     */
    async addToBank(body: AddQuestionBody, userId: string): Promise<IQuestionBankEntry> {
        const questionId = `bank-${randomUUID()}`;
        const pathPrefix = `exams/question-bank/${userId}/${questionId}`;
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

        const now = Date.now();
        const entry: IQuestionBankEntry = {
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
            createdBy: userId,
            createdAt: now,
            updatedAt: now,
        };

        return this.examImageStorageService.resolveQuestionBankEntry(
            await this.questionBankRepo.create(entry),
        );
    }

    /**
     * Lists the caller's own bank entries. `topic`/`type` filters (if given)
     * are applied in-memory after fetching everything for this creator —
     * simple on purpose, no Mongo query builder, since a single teacher's
     * bank is not expected to be large enough for that to matter.
     */
    async listMine(userId: string, filters?: { topic?: string; type?: string }): Promise<IQuestionBankEntry[]> {
        let entries = await this.questionBankRepo.findByCreator(userId);
        if (filters?.topic) {
            entries = entries.filter(e => e.topic === filters.topic);
        }
        if (filters?.type) {
            entries = entries.filter(e => e.type === filters.type);
        }
        return this.examImageStorageService.resolveQuestionBankEntries(entries);
    }

    /**
     * Removes a bank entry. Ownership check (403 if not the creator) inlined
     * here rather than in the controller, same pattern `AttemptService` uses
     * for `getById`/`listByExam` — there is no "existing" resource the
     * controller needs to fetch for any other reason first, so the check
     * lives where the entry is loaded anyway.
     */
    async remove(id: string, userId: string): Promise<void> {
        const entry = await this.questionBankRepo.findById(id);
        if (!entry) {
            throw new NotFoundError('Question-bank entry not found');
        }
        if (entry.createdBy !== userId) {
            throw new ForbiddenError('You can only manage your own question-bank entries');
        }
        await this.questionBankRepo.delete(id);
    }

    /**
     * Copies bank entries into an exam as fresh, independent exam questions.
     * The exam's ownership is verified by the caller (`QuestionBankController`
     * mirrors `ExamController`'s `assertOwnerOrAdmin` check before calling
     * this), so this method only has to guard the OTHER half of the
     * ownership story: only bank entries the caller themselves owns are
     * copied. Any requested id that belongs to another teacher's bank (or
     * doesn't exist) is silently filtered out rather than erroring — a
     * partial copy of "the ones that were actually yours" is a reasonable
     * outcome, and it means one teacher can never pull another teacher's
     * bank question into their exam via this endpoint.
     *
     * Each copied question gets a brand-new `q-<uuid>` id, distinct from the
     * bank entry's own `bank-<uuid>` id, and every field is copied by value
     * (arrays/objects shallow-cloned) rather than by reference — editing the
     * exam's copy afterwards must never mutate the bank original, or vice
     * versa. Image fields are copied as-is (already durable GCS object
     * paths from when the bank entry was created — see `addToBank` — not
     * base64), so no re-upload is needed; `ExamService.appendQuestions`
     * (which this delegates the actual exam write to) does not touch images
     * either, for the same reason.
     */
    async addToExam(examId: string, questionIds: string[], userId: string): Promise<IExam> {
        const entries = await this.questionBankRepo.findByIds(questionIds);
        const owned = entries.filter(e => e.createdBy === userId);

        const questions: IExamQuestion[] = owned.map(entry => ({
            id: `q-${randomUUID()}`,
            type: entry.type,
            questionText: entry.questionText,
            questionImage: entry.questionImage,
            options: entry.options.map(o => ({ ...o })),
            correctOptions: [...entry.correctOptions],
            marks: entry.marks,
            negativeMarks: entry.negativeMarks,
            useCustomNegative: entry.useCustomNegative,
            natAnswerType: entry.natAnswerType,
            explanation: entry.explanation,
            topic: entry.topic,
        }));

        return this.examService.appendQuestions(examId, questions);
    }
}
