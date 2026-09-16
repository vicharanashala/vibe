import 'reflect-metadata';
import { inject, injectable } from 'inversify';
import { Collection } from 'mongodb';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { IGeneratedQuestionDoc } from '../../../classes/transformers/ExamGenAI.js';

/**
 * Persisted audit record of AI-generated questions once explicitly saved —
 * wherever they went (`target`: unattached draft, embedded into an exam, or
 * added to the question bank). This is independent of where the question
 * actually ends up living: attaching to an exam also embeds it into that
 * exam's own `questions` array via `ExamService.appendQuestions`, and
 * "bank" also creates a real `QuestionBankRepository` entry (see
 * ExamGenAIController) — this collection is just the AI-generation history,
 * not the source of truth for either of those.
 */
@injectable()
export class GeneratedQuestionRepository {
    private collection!: Collection<IGeneratedQuestionDoc>;
    private initialized = false;

    constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

    private async init(): Promise<void> {
        if (this.initialized) return;
        this.collection = await this.db.getCollection<IGeneratedQuestionDoc>('aiGeneratedQuestions');
        this.initialized = true;
        try {
            await this.collection.createIndex({ createdBy: 1, createdAt: -1 });
            await this.collection.createIndex({ target: 1 });
        } catch (error) {
            console.warn('[GeneratedQuestionRepository] index creation skipped:', error);
        }
    }

    async insertMany(docs: IGeneratedQuestionDoc[]): Promise<IGeneratedQuestionDoc[]> {
        await this.init();
        if (docs.length === 0) return [];
        const result = await this.collection.insertMany(docs);
        return docs.map((d, i) => ({ ...d, _id: result.insertedIds[i] }));
    }

    async findDraftsByCreator(createdBy: string): Promise<IGeneratedQuestionDoc[]> {
        await this.init();
        return this.collection
            .find({ createdBy, target: 'draft' })
            .sort({ createdAt: -1 })
            .toArray();
    }
}
