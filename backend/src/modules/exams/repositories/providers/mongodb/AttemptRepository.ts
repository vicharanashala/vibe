import 'reflect-metadata';
import { inject, injectable } from 'inversify';
import { Collection, ObjectId } from 'mongodb';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { IExamAttempt } from '../../../classes/transformers/Attempt.js';

@injectable()
export class AttemptRepository {
    private collection!: Collection<IExamAttempt>;
    private initialized = false;

    constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

    private async init(): Promise<void> {
        if (this.initialized) return;
        this.collection = await this.db.getCollection<IExamAttempt>('examAttempts');
        this.initialized = true;

        try {
            await this.collection.createIndex({ studentId: 1, submittedAt: -1 });
            await this.collection.createIndex({ examId: 1, submittedAt: -1 });
        } catch (error) {
            // Index creation is best-effort: a replica lacking permission must not
            // stop the module from serving reads and writes.
            console.warn('[AttemptRepository] index creation skipped:', error);
        }
    }

    async create(attempt: IExamAttempt): Promise<IExamAttempt> {
        await this.init();
        const result = await this.collection.insertOne(attempt);
        return { ...attempt, _id: result.insertedId };
    }

    async findById(attemptId: string): Promise<IExamAttempt | null> {
        await this.init();
        if (!ObjectId.isValid(attemptId)) return null;
        return this.collection.findOne({ _id: new ObjectId(attemptId) });
    }

    async findByStudent(uid: string): Promise<IExamAttempt[]> {
        await this.init();
        return this.collection
            .find({ studentId: uid })
            .sort({ submittedAt: -1 })
            .toArray();
    }

    /** All attempts for an exam, newest first — backs the teacher-facing list-attempts endpoint. */
    async findByExam(examId: string): Promise<IExamAttempt[]> {
        await this.init();
        return this.collection
            .find({ examId })
            .sort({ submittedAt: -1 })
            .toArray();
    }

    /** Used by the retake-limit check in `AttemptService.submitAttempt`. */
    async findByExamAndStudent(examId: string, studentId: string): Promise<IExamAttempt | null> {
        await this.init();
        return this.collection.findOne({ examId, studentId });
    }
}
