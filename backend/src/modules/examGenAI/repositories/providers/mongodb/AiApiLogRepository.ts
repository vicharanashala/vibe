import 'reflect-metadata';
import { inject, injectable } from 'inversify';
import { Collection } from 'mongodb';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { IAiApiLogDoc } from '../../../classes/transformers/ExamGenAI.js';

/** Spend-monitoring log, one row per Anthropic call — see AnthropicClient. */
@injectable()
export class AiApiLogRepository {
    private collection!: Collection<IAiApiLogDoc>;
    private initPromise: Promise<void> | null = null;

    constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) {}

    private async init(): Promise<void> {
        if (!this.initPromise) {
            this.initPromise = this.doInit();
        }
        return this.initPromise;
    }

    private async doInit(): Promise<void> {
        this.collection = await this.db.getCollection<IAiApiLogDoc>('aiApiLogs');
        try {
            await this.collection.createIndex({ createdAt: -1 });
        } catch (error) {
            console.warn('[AiApiLogRepository] index creation skipped:', error);
        }
    }

    async log(entry: IAiApiLogDoc): Promise<void> {
        await this.init();
        await this.collection.insertOne(entry);
    }
}
