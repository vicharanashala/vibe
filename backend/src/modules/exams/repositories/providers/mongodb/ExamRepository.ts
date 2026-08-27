import 'reflect-metadata';
import { inject, injectable } from 'inversify';
import { Collection, ObjectId } from 'mongodb';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { IExam, IExamQuestion, ITimeGrant } from '../../../classes/transformers/Exam.js';

/**
 * Thin data-access layer over the `exams` collection. Questions and
 * time-grants are embedded arrays on the exam document (no separate
 * collections), so most mutations here are `$push`/`$pull`/arrayFilters
 * updates rather than joins. This module has no high-concurrency
 * requirement, so a couple of methods (question/grant update) favor the
 * simplicity of positional array updates over optimistic locking.
 */
@injectable()
export class ExamRepository {
    private collection!: Collection<IExam>;
    private initialized = false;

    constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

    private async init(): Promise<void> {
        if (this.initialized) return;
        this.collection = await this.db.getCollection<IExam>('exams');
        this.initialized = true;

        try {
            await this.collection.createIndex({ createdBy: 1, createdAt: -1 });
            await this.collection.createIndex({ published: 1, createdAt: -1 });
            await this.collection.createIndex({ 'timeGrants.code': 1 });
        } catch (error) {
            // Index creation is best-effort: a replica lacking permission must not
            // stop the module from serving reads and writes.
            console.warn('[ExamRepository] index creation skipped:', error);
        }
    }

    async create(exam: IExam): Promise<IExam> {
        await this.init();
        const result = await this.collection.insertOne(exam);
        return { ...exam, _id: result.insertedId };
    }

    async findById(examId: string): Promise<IExam | null> {
        await this.init();
        if (!ObjectId.isValid(examId)) return null;
        return this.collection.findOne({ _id: new ObjectId(examId) });
    }

    async findByCreator(uid: string): Promise<IExam[]> {
        await this.init();
        return this.collection
            .find({ createdBy: uid })
            .sort({ createdAt: -1 })
            .toArray();
    }

    async findPublished(): Promise<IExam[]> {
        await this.init();
        return this.collection
            .find({ published: true })
            .sort({ createdAt: -1 })
            .toArray();
    }

    async update(examId: string, patch: Partial<IExam>): Promise<IExam | null> {
        await this.init();
        if (!ObjectId.isValid(examId)) return null;
        // `patch` (an UpdateExamBody instance) carries every declared optional
        // field as an own `undefined` property even when absent from the
        // request body, since the esnext target gives class fields real
        // `[[Define]]` semantics. The driver's default `ignoreUndefined:
        // false` serializes those as BSON null, so spreading `patch` as-is
        // into $set would silently wipe out every field not present in this
        // particular partial update. Drop undefined (and null, which no
        // field on UpdateExamBody is documented to accept as an intentional
        // "clear this" value - every clearable field has its own explicit
        // sentinel, e.g. `{ eligibility: { mode: 'none' } }`) so only fields
        // actually sent by the caller are touched. This also self-heals: a
        // client form seeded from an already-corrupted `null` field that
        // goes untouched now round-trips as a no-op instead of re-persisting
        // the null.
        const fields = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined && v !== null));
        const result = await this.collection.findOneAndUpdate(
            { _id: new ObjectId(examId) },
            { $set: { ...fields, updatedAt: Date.now() } },
            { returnDocument: 'after' },
        );
        return result ?? null;
    }

    async delete(examId: string): Promise<boolean> {
        await this.init();
        if (!ObjectId.isValid(examId)) return false;
        const result = await this.collection.deleteOne({ _id: new ObjectId(examId) });
        return result.deletedCount === 1;
    }

    async addQuestion(examId: string, question: IExamQuestion): Promise<IExam | null> {
        await this.init();
        if (!ObjectId.isValid(examId)) return null;
        const result = await this.collection.findOneAndUpdate(
            { _id: new ObjectId(examId) },
            { $push: { questions: question }, $set: { updatedAt: Date.now() } },
            { returnDocument: 'after' },
        );
        return result ?? null;
    }

    /**
     * Batch form of `addQuestion`: appends every question in one `$push`/
     * `$each` update instead of N sequential single-question writes. Used by
     * `ExamService.addQuestionsBulk` (CSV import) and
     * `ExamService.appendQuestions` (copy-from-bank), so both call sites
     * share a single "one exam update per call" write path.
     */
    async addQuestionsBulk(examId: string, questions: IExamQuestion[]): Promise<IExam | null> {
        await this.init();
        if (!ObjectId.isValid(examId)) return null;
        const result = await this.collection.findOneAndUpdate(
            { _id: new ObjectId(examId) },
            { $push: { questions: { $each: questions } }, $set: { updatedAt: Date.now() } },
            { returnDocument: 'after' },
        );
        return result ?? null;
    }

    async updateQuestion(
        examId: string,
        questionId: string,
        patch: Partial<IExamQuestion>,
    ): Promise<IExam | null> {
        await this.init();
        if (!ObjectId.isValid(examId)) return null;

        const set: Record<string, unknown> = { updatedAt: Date.now() };
        for (const [key, value] of Object.entries(patch)) {
            if (key === 'id') continue; // id is immutable
            set[`questions.$[q].${key}`] = value;
        }

        const result = await this.collection.findOneAndUpdate(
            { _id: new ObjectId(examId), 'questions.id': questionId },
            { $set: set },
            {
                returnDocument: 'after',
                arrayFilters: [{ 'q.id': questionId }],
            },
        );
        return result ?? null;
    }

    async removeQuestion(examId: string, questionId: string): Promise<IExam | null> {
        await this.init();
        if (!ObjectId.isValid(examId)) return null;
        const result = await this.collection.findOneAndUpdate(
            { _id: new ObjectId(examId) },
            {
                $pull: { questions: { id: questionId } },
                $set: { updatedAt: Date.now() },
            },
            { returnDocument: 'after' },
        );
        return result ?? null;
    }

    async addTimeGrant(examId: string, grant: ITimeGrant): Promise<IExam | null> {
        await this.init();
        if (!ObjectId.isValid(examId)) return null;
        const result = await this.collection.findOneAndUpdate(
            { _id: new ObjectId(examId) },
            { $push: { timeGrants: grant }, $set: { updatedAt: Date.now() } },
            { returnDocument: 'after' },
        );
        return result ?? null;
    }

    async removeTimeGrant(examId: string, grantId: string): Promise<IExam | null> {
        await this.init();
        if (!ObjectId.isValid(examId)) return null;
        const result = await this.collection.findOneAndUpdate(
            { _id: new ObjectId(examId) },
            {
                $pull: { timeGrants: { id: grantId } },
                $set: { updatedAt: Date.now() },
            },
            { returnDocument: 'after' },
        );
        return result ?? null;
    }

    /**
     * Atomically flips a grant to used, only succeeding if it was still unused —
     * the redeem-race guard (two tabs submitting the same code at once).
     */
    async markTimeGrantUsed(examId: string, grantId: string): Promise<boolean> {
        await this.init();
        if (!ObjectId.isValid(examId)) return false;
        const result = await this.collection.updateOne(
            {
                _id: new ObjectId(examId),
                timeGrants: { $elemMatch: { id: grantId, used: false } },
            },
            {
                $set: {
                    'timeGrants.$.used': true,
                    'timeGrants.$.usedAt': Date.now(),
                    updatedAt: Date.now(),
                },
            },
        );
        return result.modifiedCount === 1;
    }
}
