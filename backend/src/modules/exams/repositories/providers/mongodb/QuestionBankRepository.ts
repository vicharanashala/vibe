import 'reflect-metadata';
import { inject, injectable } from 'inversify';
import { Collection, ObjectId } from 'mongodb';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { IQuestionBankEntry } from '../../../classes/transformers/QuestionBank.js';

/**
 * Thin data-access layer over the `questionBank` collection, mirroring
 * `ExamRepository`'s structure. Each document is a single reusable question
 * owned by a teacher (`createdBy`), independent of any exam — there is no
 * embedded-array shape to worry about here (unlike `exams.questions`), so
 * this repository is simpler: one document per question.
 */
@injectable()
export class QuestionBankRepository {
    private collection!: Collection<IQuestionBankEntry>;
    private initialized = false;

    constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

    private async init(): Promise<void> {
        if (this.initialized) return;
        this.collection = await this.db.getCollection<IQuestionBankEntry>('questionBank');
        this.initialized = true;

        try {
            await this.collection.createIndex({ createdBy: 1, createdAt: -1 });
        } catch (error) {
            // Index creation is best-effort: a replica lacking permission must not
            // stop the module from serving reads and writes.
            console.warn('[QuestionBankRepository] index creation skipped:', error);
        }
    }

    async create(entry: IQuestionBankEntry): Promise<IQuestionBankEntry> {
        await this.init();
        const result = await this.collection.insertOne(entry);
        return { ...entry, _id: result.insertedId };
    }

    async findByCreator(uid: string): Promise<IQuestionBankEntry[]> {
        await this.init();
        return this.collection
            .find({ createdBy: uid })
            .sort({ createdAt: -1 })
            .toArray();
    }

    async findById(id: string): Promise<IQuestionBankEntry | null> {
        await this.init();
        if (!ObjectId.isValid(id)) return null;
        return this.collection.findOne({ _id: new ObjectId(id) });
    }

    /**
     * Batch lookup for `QuestionBankService.addToExam`. Ids that fail
     * `ObjectId.isValid` are silently skipped rather than throwing — the
     * caller (service layer) is responsible for deciding what to do with a
     * requested id that didn't come back (not found vs. not owned).
     */
    async findByIds(ids: string[]): Promise<IQuestionBankEntry[]> {
        await this.init();
        const objectIds = ids.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id));
        if (objectIds.length === 0) return [];
        return this.collection.find({ _id: { $in: objectIds } }).toArray();
    }

    async delete(id: string): Promise<boolean> {
        await this.init();
        if (!ObjectId.isValid(id)) return false;
        const result = await this.collection.deleteOne({ _id: new ObjectId(id) });
        return result.deletedCount === 1;
    }
}
