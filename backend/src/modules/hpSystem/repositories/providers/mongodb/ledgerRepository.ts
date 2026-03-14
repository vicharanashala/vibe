import { HpLedgerTransformer } from "#root/modules/hpSystem/classes/transformers/Ledger.js";
import { FilterQueryDto } from "#root/modules/hpSystem/classes/validators/activitySubmissionValidators.js";
import { LedgerListResponseDto } from "#root/modules/hpSystem/classes/validators/ledgerValidators.js";
import { ILedgerRepository } from "#root/modules/hpSystem/interfaces/ILedgerRepository.js";
import { HpLedger } from "#root/modules/hpSystem/models.js";
import { MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { instanceToPlain, plainToInstance } from "class-transformer";
import { inject, injectable } from "inversify";
import { ClientSession, Collection, InsertOneResult, ObjectId } from "mongodb";

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
    ): Promise<{
        data: HpLedgerTransformer[];
        total: number;
        page: number;
        limit: number;
    }> {
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
            studentId: new ObjectId(studentId),
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

        const data = docs.map((doc) => ({
            _id: doc._id?.toString(),
            courseId: doc.courseId?.toString(),
            courseVersionId: doc.courseVersionId?.toString(),
            cohort: doc.cohort,
            studentId: doc.studentId?.toString(),
            studentEmail: doc.studentEmail,
            activityId: doc.activityId?.toString(),
            submissionId: doc.submissionId?.toString(),
            eventType: doc.eventType,
            direction: doc.direction,
            amount: doc.amount,
            calc: doc.calc
                ? {
                    ruleType: doc.calc.ruleType,
                    percentage: doc.calc.percentage ?? null,
                    absolutePoints: doc.calc.absolutePoints,
                    baseHpAtTime: doc.calc.baseHpAtTime,
                    computedAmount: doc.calc.computedAmount,
                    deadlineAt: doc.calc.deadlineAt,
                    withinDeadline: doc.calc.withinDeadline,
                    reasonCode: doc.calc.reasonCode,
                }
                : null,
            links: doc.links
                ? {
                    reversedLedgerId: doc.links.reversedLedgerId?.toString(),
                    relatedLedgerIds: Array.isArray(doc.links.relatedLedgerIds)
                        ? doc.links.relatedLedgerIds.map((id: any) => id?.toString())
                        : [],
                }
                : null,
            meta: doc.meta
                ? {
                    triggeredBy: doc.meta.triggeredBy,
                    triggeredByUserId: doc.meta.triggeredByUserId?.toString(),
                    note: doc.meta.note,
                }
                : null,
            createdAt: doc.createdAt,
        }));

        return {
            data: data as HpLedgerTransformer[],
            total,
            page,
            limit,
        };
    }

    async findByStudentAndSubmissionId(
        submissionId: string,
        studentId: string
    ): Promise<HpLedger | null> {
        await this.init();

        return await this.hpLedgerCollection.findOne(
            {
                submissionId: new ObjectId(submissionId),
                studentId: new ObjectId(studentId),
            },
            {
                sort: { createdAt: -1 },
            }
        );
    }

    async findPenaltiesByActivityId(activityId: string): Promise<HpLedger[]> {
        await this.init();

        return await this.hpLedgerCollection.find({
            activityId: new ObjectId(activityId),
            "calc.reasonCode": "MISSED_DEADLINE_PENALTY"
        }).toArray();
    }

    async findRewardsByActivityId(activityId: string): Promise<HpLedger[]> {
        await this.init();

        return await this.hpLedgerCollection.find({
            activityId: new ObjectId(activityId),
            "calc.reasonCode": "SUBMISSION_REWARD"
        }).toArray();
    }
}