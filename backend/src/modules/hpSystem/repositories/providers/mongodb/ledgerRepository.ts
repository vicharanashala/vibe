import { HpLedgerTransformer } from "#root/modules/hpSystem/classes/transformers/Ledger.js";
import { FilterQueryDto } from "#root/modules/hpSystem/classes/validators/activitySubmissionValidators.js";
import { LedgerListResponseDto } from "#root/modules/hpSystem/classes/validators/ledgerValidators.js";
import { ILedgerRepository } from "#root/modules/hpSystem/interfaces/ILedgerRepository.js";
import { HpActivity, HpLedger } from "#root/modules/hpSystem/models.js";
import { MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { instanceToPlain, plainToInstance } from "class-transformer";
import { inject, injectable } from "inversify";
import { ClientSession, Collection, InsertOneResult, ObjectId } from "mongodb";

@injectable()
export class LedgerRepository implements ILedgerRepository {
    private hpLedgerCollection: Collection<HpLedger>;
    private hpActivityCollection: Collection<HpActivity>;
    constructor(
        @inject(GLOBAL_TYPES.Database)
        private db: MongoDatabase,
    ) { }

    async init() {
        this.hpLedgerCollection = await this.db.getCollection<HpLedger>('hp_ledger');
        this.hpActivityCollection = await this.db.getCollection<HpActivity>('hp_activities');
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
        filter: FilterQueryDto,
        cohortName: string,
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

            this.hpLedgerCollection.aggregate([

                { $match: { ...query, cohort: cohortName } },

                {
                    $lookup: {
                        from: "hp_activities",
                        let: { activityId: "$activityId" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $eq: ["$_id", "$$activityId"] }
                                }
                            },
                            {
                                $project: { _id: 0, title: 1 }
                            }
                        ],
                        as: "activity"
                    }
                },

                {
                    $unwind: {
                        path: "$activity",
                        preserveNullAndEmptyArrays: true
                    }
                },

                {
                    $addFields: {
                        triggeredByUserObjectId: {
                            $convert: {
                                input: "$meta.triggeredByUserId",
                                to: "objectId",
                                onError: null,
                                onNull: null,
                            }
                        }
                    }
                },

                {
                    $lookup: {
                        from: "users",
                        localField: "triggeredByUserObjectId",
                        foreignField: "_id",
                        as: "triggeredByUser"
                    }
                },

                {
                    $unwind: {
                        path: "$triggeredByUser",
                        preserveNullAndEmptyArrays: true
                    }
                },

                { $sort: sort },
                { $skip: skip },
                { $limit: limit },

                {
                    $addFields: {
                        activityTitle: "$activity.title",
                        triggeredByUserName: {
                            $cond: [
                                { $ifNull: ["$triggeredByUser._id", false] },
                                {
                                    $trim: {
                                        input: {
                                            $concat: [
                                                { $ifNull: ["$triggeredByUser.firstName", ""] },
                                                " ",
                                                { $ifNull: ["$triggeredByUser.lastName", ""] }
                                            ]
                                        }
                                    }
                                },
                                null
                            ]
                        }
                    }
                }

            ]).toArray(),

            this.hpLedgerCollection.countDocuments({
                ...query,
                cohort: cohortName
            })
        ]);

        const data = docs.map((doc) => ({
            _id: doc._id?.toString(),
            courseId: doc.courseId?.toString(),
            courseVersionId: doc.courseVersionId?.toString(),
            cohort: doc.cohort,
            studentId: doc.studentId?.toString(),
            studentEmail: doc.studentEmail,
            activityId: doc.activityId?.toString(),
            activityTitle: doc.activityTitle,
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
                    triggeredByUserName: doc.triggeredByUserName ?? null,
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
    async findByStudentAndActivityId(
        activityId: string,
        studentId: string
    ): Promise<HpLedger | null> {
        await this.init();

        return await this.hpLedgerCollection.findOne(
            {
                activityId: new ObjectId(activityId),
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

    async findAllExisitingMilestoneRewards(activityId: string): Promise<HpLedger[]> {
        await this.init();

        return await this.hpLedgerCollection.find({
            activityId: new ObjectId(activityId),
            "calc.reasonCode": "MILESTONE_REWARD"
        }).toArray();
    }

    async findRewardsByActivityId(activityId: string): Promise<HpLedger[]> {
        await this.init();

        return await this.hpLedgerCollection.find({
            activityId: new ObjectId(activityId),
            "calc.reasonCode": "MILESTONE_REWARD"
        }).toArray();
    }

    async findBySubmissionIds(submissionIds: string[]): Promise<HpLedger[]> {
        await this.init();
        
        const objectIds = submissionIds.map(id => new ObjectId(id));
        
        return await this.hpLedgerCollection.find({
            activityId: { $in: objectIds }
        }).toArray();
    }

    async getHpDistributionForCohort(
        cohortName: string,
        courseVersionId: string,
        session?: ClientSession
    ): Promise<{
        low: number;
        medium: number;
        high: number;
        veryHigh: number;
    }> {
        await this.init();
        
        const pipeline = [
            {
                $match: {
                    cohort: cohortName,
                    courseVersionId: new ObjectId(courseVersionId)
                }
            },
            {
                $group: {
                    _id: "$studentId",
                    totalHp: { $sum: "$points" }
                }
            },
            {
                $group: {
                    _id: null,
                    low: {
                        $sum: {
                            $cond: [{ $lte: ["$totalHp", 50] }, 1, 0]
                        }
                    },
                    medium: {
                        $sum: {
                            $cond: [
                                { $and: [{ $gt: ["$totalHp", 50] }, { $lte: ["$totalHp", 100] }] },
                                1,
                                0
                            ]
                        }
                    },
                    high: {
                        $sum: {
                            $cond: [
                                { $and: [{ $gt: ["$totalHp", 100] }, { $lte: ["$totalHp", 200] }] },
                                1,
                                0
                            ]
                        }
                    },
                    veryHigh: {
                        $sum: {
                            $cond: [{ $gt: ["$totalHp", 200] }, 1, 0]
                        }
                    }
                }
            }
        ];
        
        const result = await this.hpLedgerCollection.aggregate(pipeline, { session }).toArray();
        
        return {
            low: result[0]?.low || 0,
            medium: result[0]?.medium || 0,
            high: result[0]?.high || 0,
            veryHigh: result[0]?.veryHigh || 0
        };
    }

}