import { FilterQueryDto } from "#root/modules/hpSystem/classes/validators/activitySubmissionValidators.js";
import { ILedgerRepository } from "#root/modules/hpSystem/interfaces/ILedgerRepository.js";
import { HpLedger } from "#root/modules/hpSystem/models.js";
import { MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { inject, injectable } from "inversify";
import { Collection, InsertOneResult } from "mongodb";

@injectable()
export class LedgerRepository implements ILedgerRepository {
    private hpLedgerCollection: Collection<HpLedger>;

    constructor(
        @inject(GLOBAL_TYPES.Database)
        private db: MongoDatabase,
    ) { }

    async init() {
        this.hpLedgerCollection = await this.db.getCollection<HpLedger>('hp_ledger');
    }

    create(entry: Omit<HpLedger, "_id" | "createdAt">): Promise<InsertOneResult<HpLedger>> {
        const now = new Date();
        return this.hpLedgerCollection.insertOne({
            ...entry,
            createdAt: now,
        });
    }

    async listByStudentId(
        studentId: string,
        filter: FilterQueryDto
    ): Promise<HpLedger[]> {
        await this.init();

        const {
            page = 1,
            limit = 10,
            search,
            sortBy = "createdAt",
            sortOrder = "desc",
        } = filter;

        const skip = (page - 1) * limit;

        const query: any = {
            studentId: studentId,
        };

        if (search) {
            query.$or = [
                { studentEmail: { $regex: search, $options: "i" } },
                { eventType: { $regex: search, $options: "i" } },
                { "calc.reasonCode": { $regex: search, $options: "i" } },
            ];
        }

        const sort: any = {
            [sortBy]: sortOrder === "asc" ? 1 : -1,
        };

        const docs = await this.hpLedgerCollection
            .find(query)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .toArray();

        return docs;
    }
}