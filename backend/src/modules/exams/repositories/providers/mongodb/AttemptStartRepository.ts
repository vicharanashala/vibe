import 'reflect-metadata';
import { inject, injectable } from 'inversify';
import { Collection } from 'mongodb';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';

interface IAttemptStartDoc {
    examId: string;
    studentId: string;
    startedAt: number;
}

/**
 * Server-observed "a student began this exam" timestamp, one document per
 * (examId, studentId) — the source of truth `AttemptService.submitAttempt`
 * enforces the duration deadline against. A client-supplied `startedAt` on
 * the submit request can't be trusted: a student who can already stop the
 * countdown via devtools can just as easily report a fresh timestamp at
 * submit time regardless of how long they actually spent. Stamping
 * `Date.now()` here, server-side, the first time `getOrCreate` is called for
 * a given (examId, studentId), and then treating every later call as a
 * read (never overwriting), closes that gap — no client input ever reaches
 * this timestamp.
 */
@injectable()
export class AttemptStartRepository {
    private collection!: Collection<IAttemptStartDoc>;
    private initPromise: Promise<void> | null = null;

    constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

    private async init(): Promise<void> {
        if (!this.initPromise) {
            this.initPromise = this.doInit();
        }
        return this.initPromise;
    }

    private async doInit(): Promise<void> {
        this.collection = await this.db.getCollection<IAttemptStartDoc>('examAttemptStarts');
        try {
            await this.collection.createIndex({ examId: 1, studentId: 1 }, { unique: true });
        } catch (error) {
            console.error(
                '[AttemptStartRepository] FAILED to create the (examId, studentId) uniqueness index — ' +
                    'concurrent first-starts could each record their own startedAt until this is fixed ' +
                    '(check this Mongo user has index-creation permission):',
                error,
            );
        }
    }

    /**
     * Returns the server-recorded start time for this (examId, studentId),
     * stamping `Date.now()` the first time it's called and returning that
     * same value on every subsequent call (including concurrent ones — the
     * unique index makes the loser of a race fall back to reading the
     * winner's document rather than overwriting it).
     */
    async getOrCreate(examId: string, studentId: string): Promise<number> {
        await this.init();
        const startedAt = Date.now();
        try {
            await this.collection.insertOne({ examId, studentId, startedAt });
            return startedAt;
        } catch (error) {
            if ((error as { code?: number })?.code === 11000) {
                const existing = await this.collection.findOne({ examId, studentId });
                if (existing) return existing.startedAt;
            }
            throw error;
        }
    }

    async get(examId: string, studentId: string): Promise<number | null> {
        await this.init();
        const existing = await this.collection.findOne({ examId, studentId });
        return existing?.startedAt ?? null;
    }

    /**
     * Clears the start record once an attempt has been successfully
     * submitted. Required for `allowRetakes: true` exams: the unique index
     * on (examId, studentId) means `getOrCreate` would otherwise keep
     * returning attempt #1's timestamp forever, so a later retake's
     * duration would be measured from the wrong clock (typically already
     * "expired" the instant it starts) instead of getting a fresh one.
     * Called unconditionally from `submitAttempt` after a successful
     * `attemptRepo.create` — harmless no-op for `allowRetakes: false`
     * exams, where a second `/start` call is possible but `submitAttempt`'s
     * own retake check still blocks a second submission regardless.
     */
    async delete(examId: string, studentId: string): Promise<void> {
        await this.init();
        await this.collection.deleteOne({ examId, studentId });
    }
}
