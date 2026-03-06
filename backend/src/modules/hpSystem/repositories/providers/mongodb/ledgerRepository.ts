import { HpLedgerTransformer } from "#root/modules/hpSystem/classes/transformers/Ledger.js";
import { FilterQueryDto } from "#root/modules/hpSystem/classes/validators/activitySubmissionValidators.js";
import { LedgerListResponseDto } from "#root/modules/hpSystem/classes/validators/ledgerValidators.js";
import { ILedgerRepository } from "#root/modules/hpSystem/interfaces/ILedgerRepository.js";
import { HpLedger } from "#root/modules/hpSystem/models.js";
import { MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { plainToInstance } from "class-transformer";
import { inject, injectable } from "inversify";
import { ClientSession, Collection, InsertOneResult } from "mongodb";

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

    async create(entry: Omit<HpLedger, "_id" | "createdAt">, session?: ClientSession): Promise<InsertOneResult<HpLedger>> {
        await this.init();
        const now = new Date();
        return await this.hpLedgerCollection.insertOne({
            ...entry,
            createdAt: now,
        }, { session });
    }

    async listByStudentId(
        studentId: string,
        filter: FilterQueryDto
    ): Promise<LedgerListResponseDto> {
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
            studentId,
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

        const [docs, total] = await Promise.all([
            this.hpLedgerCollection
                .find(query)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .toArray(),
            this.hpLedgerCollection.countDocuments(query),
        ]);

        return plainToInstance(
            LedgerListResponseDto,
            {
                data: plainToInstance(HpLedgerTransformer, docs, {
                    excludeExtraneousValues: true,
                    enableImplicitConversion: true,
                }),
                total,
                page,
                limit,
            },
            {
                excludeExtraneousValues: true,
                enableImplicitConversion: true,
            }
        );
    }
}