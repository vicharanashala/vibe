import { FilterQueryDto, ListSubmissionsQueryDto, ReviewHpActivitySubmissionBodyDto, StudentActivitySubmissionsViewDto, SubmissionPayloadDto } from "#root/modules/hpSystem/classes/validators/activitySubmissionValidators.js";
import { IActivitySubmissionRepository } from "#root/modules/hpSystem/interfaces/IActivitySubmissionRepository.js";
import { HpActivitySubmission, SubmissionSource, SubmissionStatus } from "#root/modules/hpSystem/models.js";
import { ID, MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { plainToInstance } from "class-transformer";
import { inject, injectable } from "inversify";
import { ClientSession, Collection, ObjectId } from "mongodb";

@injectable()
export class ActivitySubmissionsRepository implements IActivitySubmissionRepository {
    private hpActivitySubmissionCollection: Collection<HpActivitySubmission>;

    constructor(
        @inject(GLOBAL_TYPES.Database)
        private db: MongoDatabase,
    ) { }

    async init() {
        this.hpActivitySubmissionCollection = await this.db.getCollection<HpActivitySubmission>(
            'hp_activity_submissions',
        );
    }


    async create(
        input: {
            courseId: ID;
            courseVersionId: ID;
            cohort: ID;
            activityId: ID;

            studentId: ID;
            studentEmail: string;
            studentName: string;

            payload: SubmissionPayloadDto;
            submissionSource: SubmissionSource;

            isLate: boolean;
        },
        opts?: { session?: ClientSession }
    ): Promise<string> {
        await this.init();

        const now = new Date();


        const doc = {
            ...input,

            status: "SUBMITTED" as SubmissionStatus,
            submittedAt: now,

            review: null,
            ledgerRefs: {
                rewardLedgerId: null,
                revertLedgerIds: [],
                penaltyLedgerId: null,
            },
            createdAt: now,
            updatedAt: now,
        }

        const res = await this.hpActivitySubmissionCollection.insertOne(doc as any, {
            session: opts?.session,
        });

        return res.insertedId.toString();
    }

    async findById(id: string, opts?: { session?: ClientSession }): Promise<any | null> {
        await this.init();
        if (!ObjectId.isValid(id)) return null;
        return this.hpActivitySubmissionCollection.findOne(
            { _id: new ObjectId(id), isDeleted: { $ne: true } },
            { session: opts?.session }
        );
    }

    async getByStudentId(
        studentId: string,
        query: FilterQueryDto
    ): Promise<StudentActivitySubmissionsViewDto[]> {
        await this.init();

        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;

        const search = query.search?.trim();
        const searchRegex = search
            ? new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
            : null;

        const sortOrder = query.sortOrder === "asc" ? 1 : -1;
        const sortByRaw = (query.sortBy ?? "submittedAt").trim();

        // allowlist sort keys
        const SORT_MAP: Record<string, any> = {
            submittedAt: { submittedAt: sortOrder },
            updatedAt: { updatedAt: sortOrder },
            status: { status: sortOrder },
            activityTitle: { "activity.title": sortOrder },
            deadline: { "rule.deadlineAt": sortOrder },
        };
        const sortStage = SORT_MAP[sortByRaw] ?? { submittedAt: -1 };

        // studentId can be stored as string or ObjectId
        const studentIdOr: any[] = [{ studentId }];
        if (ObjectId.isValid(studentId)) studentIdOr.push({ studentId: new ObjectId(studentId) });

        const pipeline: any[] = [
            // 1) Submissions by student
            {
                $match: {
                    $or: studentIdOr,
                },
            },

            // 2) Lookup activity details
            {
                $lookup: {
                    from: "hp_activities",
                    localField: "activityId",
                    foreignField: "_id",
                    as: "activity",
                },
            },
            { $unwind: { path: "$activity", preserveNullAndEmptyArrays: true } },


            // 4) Lookup rule config for deadline + reward
            {
                $lookup: {
                    from: "hp_activity_rules",
                    let: { aid: "$activityId", cvid: "$courseVersionId", cid: "$courseId" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$activityId", "$$aid"] },
                                        { $eq: ["$courseVersionId", "$$cvid"] },
                                        { $eq: ["$courseId", "$$cid"] },
                                    ],
                                },
                            },
                        },
                        { $limit: 1 },
                    ],
                    as: "rule",
                },
            },
            { $unwind: { path: "$rule", preserveNullAndEmptyArrays: true } },

            // 5) Search (activity title/description)
            ...(searchRegex
                ? [
                    {
                        $match: {
                            $or: [
                                { "activity.title": searchRegex },
                                { "activity.description": searchRegex },
                                // { "payload.textResponse": searchRegex },
                            ],
                        },
                    },
                ]
                : []),

            // 6) Compute HP (basic; adjust later when ledger logic is ready)
            {
                $addFields: {
                    baseHp: {
                        $cond: [
                            { $and: [{ $ifNull: ["$rule.reward.enabled", false] }, { $gt: ["$rule.reward.value", 0] }] },
                            "$rule.reward.value",
                            0,
                        ],
                    },
                },
            },
            {
                $addFields: {
                    currentHp: {
                        $switch: {
                            branches: [
                                { case: { $eq: ["$status", "APPROVED"] }, then: "$baseHp" },
                                { case: { $eq: ["$status", "REVERTED"] }, then: 0 },
                                { case: { $eq: ["$status", "REJECTED"] }, then: 0 },
                                { case: { $eq: ["$status", "SUBMITTED"] }, then: 0 },
                            ],
                            default: 0,
                        },
                    },
                },
            },

            // 7) Shape into your response DTO
            {
                $project: {
                    id: { $toString: "$_id" },

                    isRequiredInstructorApproval: {
                        $cond: {
                            if: {
                                $and: [
                                    { $eq: ["$status", "SUBMITTED"] },
                                    { $eq: ["$rule.reward.applyWhen", "ON_APPROVAL"] }
                                ]
                            },
                            then: true,
                            else: false
                        }
                    },
                    activity: {
                        id: { $toString: "$activity._id" },
                        title: { $ifNull: ["$activity.title", ""] },
                        description: { $ifNull: ["$activity.description", ""] },
                        activityType: { $ifNull: ["$activity.activityType", "OTHER"] },
                    },

                    deadline: "$rule.deadlineAt",

                    submission: {
                        status: "$status",
                        submittedAt: "$submittedAt",
                        isLate: "$isLate",

                        attachments: {
                            textResponse: { $ifNull: ["$payload.textResponse", ""] },
                            links: { $ifNull: ["$payload.links", []] },

                            files: {
                                $map: {
                                    input: { $ifNull: ["$payload.files", []] },
                                    as: "f",
                                    in: { url: "$$f.url", name: "$$f.name" },
                                },
                            },

                            images: {
                                $map: {
                                    input: { $ifNull: ["$payload.images", []] },
                                    as: "img",
                                    in: { url: "$$img.url", name: "$$img.name" },
                                },
                            },
                        },
                    },

                    hp: {
                        baseHp: "$baseHp",
                        currentHp: "$currentHp",
                    },

                    instructorFeedback: {
                        $cond: [
                            { $ifNull: ["$review", false] },
                            {
                                reviewedBy: { $toString: "$review.reviewedByTeacherId" },
                                reviewedAt: "$review.reviewedAt",
                                decision: "$review.decision",
                                note: "$review.note",
                            },
                            null,
                        ],
                    },
                },
            },

            // 8) sort + paginate
            { $sort: sortStage },
            { $skip: skip },
            { $limit: limit },
        ];

        const docs = await this.hpActivitySubmissionCollection.aggregate(pipeline).toArray();

        return plainToInstance(StudentActivitySubmissionsViewDto, docs, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true,
        });
    }

    async list(query: ListSubmissionsQueryDto, opts?: { session?: ClientSession }): Promise<any[]> {
        await this.init();

        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;

        const sortOrder = query.sortOrder === "desc" ? -1 : 1;
        const sortByRaw = (query.sortBy ?? "submittedAt").trim();

        const SORT_MAP: Record<string, any> = {
            submittedAt: { submittedAt: sortOrder },
            status: { status: sortOrder },
            studentName: { studentName: sortOrder },
            studentEmail: { studentEmail: sortOrder },
            createdAt: { createdAt: sortOrder },
        };
        const sortStage = SORT_MAP[sortByRaw] ?? { submittedAt: -1 };

        const q: any = { isDeleted: { $ne: true } };

        if (query.courseVersionId) q.courseVersionId = query.courseVersionId;
        if (query.cohort) q.cohort = query.cohort;
        if (query.activityId) q.activityId = query.activityId;
        if (query.status) q.status = query.status;

        if (query.search?.trim()) {
            const safe = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const r = new RegExp(safe, "i");
            q.$or = [{ studentName: r }, { studentEmail: r }];
        }

        return this.hpActivitySubmissionCollection
            .find(q, { session: opts?.session })
            .sort(sortStage)
            .skip(skip)
            .limit(limit)
            .toArray();
    }

    async updateStatusAndReview(
        id: string,
        update: any,
        opts?: { session?: ClientSession }
    ): Promise<void> {
        await this.init();
        if (!ObjectId.isValid(id)) return;

        await this.hpActivitySubmissionCollection.updateOne(
            { _id: new ObjectId(id), isDeleted: { $ne: true } },
            { $set: { ...update, updatedAt: new Date() } },
            { session: opts?.session }
        );
    }
}