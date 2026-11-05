import 'reflect-metadata';
import { inject, injectable } from 'inversify';
import { Collection, ObjectId } from 'mongodb';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { IExamAttempt } from '../../../classes/transformers/Attempt.js';

/**
 * Thrown by `AttemptRepository.create` when the `noRetakesLock` partial
 * unique index rejects a second attempt for the same (examId, studentId) —
 * i.e. the atomic version of the "already attempted" check, for the
 * concurrent-submission race the pre-insert read alone can't close.
 */
export class DuplicateAttemptError extends Error {}

@injectable()
export class AttemptRepository {
    private collection!: Collection<IExamAttempt>;
    private initPromise: Promise<void> | null = null;

    constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

    private async init(): Promise<void> {
        if (!this.initPromise) {
            this.initPromise = this.doInit();
        }
        return this.initPromise;
    }

    private async doInit(): Promise<void> {
        this.collection = await this.db.getCollection<IExamAttempt>('examAttempts');

        try {
            await this.collection.createIndex({ studentId: 1, submittedAt: -1 });
            await this.collection.createIndex({ examId: 1, submittedAt: -1 });
        } catch (error) {
            // These two are query-performance indexes only — best-effort: a
            // replica lacking permission must not stop the module from
            // serving reads and writes.
            console.warn('[AttemptRepository] index creation skipped:', error);
        }

        try {
            // Closes the retake race condition: `AttemptService.submitAttempt`'s
            // "does an attempt already exist" read-then-insert isn't atomic on
            // its own, so two concurrent submissions for a no-retake exam could
            // both pass that check. This partial unique index makes the second
            // insert fail atomically instead — only documents that opt in via
            // `noRetakesLock: true` (set exactly when `exam.allowRetakes ===
            // false`) participate, so retake-allowed exams are unaffected.
            //
            // Unlike the two indexes above, this one is correctness-critical,
            // not a performance nicety — `submitAttempt`'s pre-insert read is
            // documented as NOT sufficient on its own. If this fails to
            // create (e.g. insufficient permission on this Mongo user), the
            // retake race is silently unprotected, so it's logged at `error`
            // level, distinctly from the routine-skip warning above, so it
            // surfaces in monitoring rather than blending into normal
            // best-effort index noise.
            await this.collection.createIndex(
                { examId: 1, studentId: 1 },
                { unique: true, partialFilterExpression: { noRetakesLock: true } },
            );
        } catch (error) {
            console.error(
                '[AttemptRepository] FAILED to create the no-retake uniqueness index — ' +
                    'the retake race condition is UNPROTECTED until this is fixed ' +
                    '(check this Mongo user has index-creation permission):',
                error,
            );
        }
    }

    async create(attempt: IExamAttempt): Promise<IExamAttempt> {
        await this.init();
        try {
            const result = await this.collection.insertOne(attempt);
            return { ...attempt, _id: result.insertedId };
        } catch (error) {
            if ((error as { code?: number })?.code === 11000) {
                throw new DuplicateAttemptError('You have already attempted this exam');
            }
            throw error;
        }
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
