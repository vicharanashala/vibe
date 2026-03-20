import { SubmissionFeedbackItem } from "#root/modules/hpSystem/classes/transformers/ActivitySubmission.js";
import { FilterQueryDto, ListSubmissionsQueryDto, ReviewHpActivitySubmissionBodyDto, StudentActivitySubmissionsViewDto, SubmissionPayloadDto } from "#root/modules/hpSystem/classes/validators/activitySubmissionValidators.js";
import { IActivitySubmissionRepository } from "#root/modules/hpSystem/interfaces/IActivitySubmissionRepository.js";
import { HpActivitySubmission, SubmissionSource, SubmissionStatus } from "#root/modules/hpSystem/models.js";
import { ID, MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { plainToInstance } from "class-transformer";
import { inject, injectable } from "inversify";
import { ClientSession, Collection, ObjectId } from "mongodb";
import { NotFoundError } from "routing-controllers";

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

    async updateById(
        submissionId: string,
        input: Partial<HpActivitySubmission>,
        opts?: { session?: ClientSession }
    ): Promise<void> {
        await this.init();

        const now = new Date();

        const updateDoc: any = {
            ...input,
            updatedAt: now,
        };

        await this.hpActivitySubmissionCollection.updateOne(
            { _id: new ObjectId(submissionId) },
            {
                $set: updateDoc,
            },
            {
                session: opts?.session,
            }
        );
    }

    async findById(id: string, opts?: { session?: ClientSession }): Promise<HpActivitySubmission | null> {
        await this.init();
        if (!ObjectId.isValid(id)) return null;
        return this.hpActivitySubmissionCollection.findOne(
            { _id: new ObjectId(id), isDeleted: { $ne: true } },
            { session: opts?.session }
        );
    }

    async getByStudentId(
        studentId: string,
        query: FilterQueryDto,
        courseId?: string,
        courseVersionId?: string,
        cohortName?: string
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

        const matchStage: any = {
            $or: studentIdOr,
        };

        if (courseId)
            matchStage.courseId = new ObjectId(courseId);

        if (courseVersionId)
            matchStage.courseVersionId = new ObjectId(courseVersionId)

        if (cohortName)
            matchStage.cohort = cohortName;


        const pipeline: any[] = [
            // 1) Submissions by student
            {
                $match: matchStage,
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

            // 5) Lookup teachers for feedback enrichment
            {
                $lookup: {
                    from: "users",
                    let: { 
                        teacherIds: {
                            $setUnion: [
                                {
                                    $map: {
                                        input: { $ifNull: ["$feedbacks", []] },
                                        as: "fb",
                                        in: { $toObjectId: "$$fb.teacherId" }
                                    }
                                }
                            ]
                        }
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $in: ["$_id", "$$teacherIds"] }
                            }
                        },
                        {
                            $project: {
                                _id: 1,
                                email: 1,
                                firstName: 1,
                                lastName: 1
                            }
                        }
                    ],
                    as: "teachers"
                }
            },

            // 6) Include all feedbacks from feedbacks array and enrich with teacher info
            {
                $addFields: {
                    feedbacks: {
                        $map: {
                            input: { $ifNull: ["$feedbacks", []] },
                            as: "fb",
                            in: {
                                $mergeObjects: [
                                    "$$fb",
                                    {
                                        teacherId: { $toString: "$$fb.teacherId" },
                                        username: {
                                            $let: {
                                                vars: {
                                                    teacher: {
                                                        $arrayElemAt: [
                                                            {
                                                                $filter: {
                                                                    input: "$teachers",
                                                                    cond: { $eq: ["$$this._id", { $toObjectId: "$$fb.teacherId" }] }
                                                                }
                                                            },
                                                            0
                                                        ]
                                                    }
                                                },
                                                in: {
                                                    $ifNull: [
                                                        { $concat: ["$$teacher.firstName", " ", "$$teacher.lastName"] },
                                                        "Unknown"
                                                    ]
                                                }
                                            }
                                        },
                                        email: {
                                            $let: {
                                                vars: {
                                                    teacher: {
                                                        $arrayElemAt: [
                                                            {
                                                                $filter: {
                                                                    input: "$teachers",
                                                                    cond: { $eq: ["$$this._id", { $toObjectId: "$$fb.teacherId" }] }
                                                                }
                                                            },
                                                            0
                                                        ]
                                                    }
                                                },
                                                in: {
                                                    $ifNull: [
                                                        "$$teacher.email",
                                                        "N/A"
                                                    ]
                                                }
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            },

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

            // 7) Lookup reviewer details (teacher/admin user)
            {
                $addFields: {
                    reviewedByTeacherObjectId: {
                        $convert: {
                            input: "$review.reviewedByTeacherId",
                            to: "objectId",
                            onError: null,
                            onNull: null,
                        },
                    },
                },
            },
            {
                $lookup: {
                    from: "users",
                    localField: "reviewedByTeacherObjectId",
                    foreignField: "_id",
                    as: "reviewerUser",
                },
            },
            { $unwind: { path: "$reviewerUser", preserveNullAndEmptyArrays: true } },

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
                        _id: { $toString: "$_id" },
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
                            { $ne: ["$review", null] },
                            {
                                reviewedBy: { $toString: "$review.reviewedByTeacherId" },
                                reviewerEmail: { $ifNull: ["$reviewerUser.email", null] },
                                reviewerName: {
                                    $cond: [
                                        { $ifNull: ["$reviewerUser._id", false] },
                                        {
                                            $trim: {
                                                input: {
                                                    $concat: [
                                                        { $ifNull: ["$reviewerUser.firstName", ""] },
                                                        " ",
                                                        { $ifNull: ["$reviewerUser.lastName", ""] },
                                                    ],
                                                },
                                            },
                                        },
                                        null,
                                    ],
                                },
                                reviewedAt: "$review.reviewedAt",
                                decision: "$review.decision",
                                note: "$review.note",
                            },
                            null,
                        ],
                    },

                    feedbacks: {
                        $map: {
                            input: { $ifNull: ["$feedbacks", []] },
                            as: "fb",
                            in: {
                                feedback: "$$fb.feedback",
                                teacherId: { $toString: "$$fb.teacherId" },
                                feedbackAt: "$$fb.feedbackAt",
                                username: "$$fb.username",
                                email: "$$fb.email"
                            }
                        }
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

    async list(query: ListSubmissionsQueryDto, opts?: { session?: ClientSession }): Promise<HpActivitySubmission[]> {
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

        const q: any = {};

        if (query.courseVersionId) q.courseVersionId = new ObjectId(query.courseVersionId);
        if (query.cohort) q.cohort = query.cohort;
        if (query.activityId) q.activityId = new ObjectId(query.activityId);
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
        update: Partial<HpActivitySubmission>,
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

    async getLatestByStudentId(studentId: string, activityId: string): Promise<HpActivitySubmission | null> {
        await this.init()
        return await this.hpActivitySubmissionCollection.findOne({ studentId: new ObjectId(studentId), activityId: new ObjectId(activityId) }, { sort: { createdAt: -1 } })
    }

    async getCountByStudentId(studentId: string, courseId: string, courseVersionId: string): Promise<number> {
        await this.init();
        return await this.hpActivitySubmissionCollection.countDocuments({
            studentId: new ObjectId(studentId),
            courseId: new ObjectId(courseId),
            courseVersionId: new ObjectId(courseVersionId),
        });
    }

    async getLateSubmissionCountByStudentId(studentId: string, courseId: string, courseVersionId: string): Promise<number> {
        await this.init();
        return await this.hpActivitySubmissionCollection.countDocuments({
            studentId: new ObjectId(studentId),
            courseId: new ObjectId(courseId),
            courseVersionId: new ObjectId(courseVersionId),
            isLate: true
        });
    }

    async updateFeedbackById(id: string, feedback: SubmissionFeedbackItem, session?: ClientSession): Promise<boolean> {
        await this.init();

        const result = await this.hpActivitySubmissionCollection.updateOne(
            { _id: new ObjectId(id) },
            {
                $push: {
                    feedbacks: {
                        teacherId: new ObjectId(feedback.teacherId),
                        feedbackAt: feedback.feedbackAt,
                        feedback: feedback.feedback.trim(),
                    },
                },
            }
        );

        if (result.matchedCount === 0) {
            throw new NotFoundError("Submission not found");
        }

        return true;
    }

    async getCohortActivityStats(
        cohortName: string,
        activityId: string,
        session?: ClientSession
    ): Promise<{
        totalSubmissions: number;
        approvedCount: number;
        rejectedCount: number;
        revertedCount: number;
        submittedCount: number;
    }> {
        await this.init();

        const result = await this.hpActivitySubmissionCollection.aggregate([

            {
                $match: {
                    cohort: cohortName,
                    activityId: new ObjectId(activityId)
                }
            },

            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            }

        ], { session }).toArray();

        // Default structure
        const stats = {
            totalSubmissions: 0,
            approvedCount: 0,
            rejectedCount: 0,
            revertedCount: 0,
            submittedCount: 0


        };

        // Fill counts
        result.forEach(r => {
            const count = r.count || 0;

            stats.totalSubmissions += count;

            if (r._id === "APPROVED") stats.approvedCount = count;
            if (r._id === "REJECTED") stats.rejectedCount = count;
            if (r._id === "REVERT") stats.revertedCount = count;
            if (r._id === "SUBMITTED") stats.submittedCount = count;
        });

        return stats;
    }
    async getCohortStatsMap(
        cohortName: string,
        courseVersionId: string,
        session?: ClientSession
    ) {
        await this.init();

        const result = await this.hpActivitySubmissionCollection.aggregate([

            {
                $match: {
                    cohort: cohortName,
                    courseVersionId: new ObjectId(courseVersionId)
                }
            },

            {
                $group: {
                    _id: {
                        activityId: "$activityId",
                        status: "$status"
                    },
                    count: { $sum: 1 }
                }
            }

        ]).toArray();

        const statsMap: Record<string, any> = {};

        result.forEach(r => {
            const activityId = r._id.activityId.toString();
            const status = r._id.status;

            if (!statsMap[activityId]) {
                statsMap[activityId] = {
                    approvedCount: 0,
                    rejectedCount: 0,
                    submittedCount: 0,
                    revertedCount: 0,
                };
            }

            if (status === "APPROVED") statsMap[activityId].approvedCount = r.count;
            if (status === "REJECTED") statsMap[activityId].rejectedCount = r.count;
            if (status === "SUBMITTED") statsMap[activityId].submittedCount = r.count;
            if (status === "REVERT") statsMap[activityId].revertedCount = r.count;
            if (status === "SUBMITTED") statsMap[activityId].submittedCount = r.count;
        });

        return statsMap;
    }
}