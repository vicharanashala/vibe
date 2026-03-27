import { SubmissionFeedbackItem } from "#root/modules/hpSystem/classes/transformers/ActivitySubmission.js";
import { FilterQueryDto, ListSubmissionsQueryDto, ReviewHpActivitySubmissionBodyDto, StudentActivitySubmissionsViewDto, SubmissionPayloadDto } from "#root/modules/hpSystem/classes/validators/activitySubmissionValidators.js";
import { IActivitySubmissionRepository } from "#root/modules/hpSystem/interfaces/IActivitySubmissionRepository.js";
import { IActivityRepository } from "#root/modules/hpSystem/interfaces/IActivityRepository.js";
import { HpActivitySubmission, HpRuleConfig, SubmissionSource, SubmissionStatus } from "#root/modules/hpSystem/models.js";
import { ID, MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { HP_SYSTEM_TYPES } from "#root/modules/hpSystem/types.js";
import { plainToInstance } from "class-transformer";
import { inject, injectable } from "inversify";
import { ClientSession, Collection, ObjectId } from "mongodb";
import { NotFoundError } from "routing-controllers";

@injectable()
export class ActivitySubmissionsRepository implements IActivitySubmissionRepository {
    private hpActivitySubmissionCollection: Collection<HpActivitySubmission>;
    private hpRuleConfigsCollection!: Collection<HpRuleConfig>;

    constructor(
        @inject(GLOBAL_TYPES.Database)
        private db: MongoDatabase,
        @inject(HP_SYSTEM_TYPES.activityRepository)
        private activityRepository: IActivityRepository,
    ) { }

    async init() {
        this.hpActivitySubmissionCollection = await this.db.getCollection<HpActivitySubmission>(
            'hp_activity_submissions',
        );
        this.hpRuleConfigsCollection =
            await this.db.getCollection<HpRuleConfig>("hp_activity_rules");
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
    ): Promise<any[]> {
        await this.init();

        const page = query.page ?? 1;
        const limit = query.limit ?? 0;
        const skip = limit > 0 ? (page - 1) * limit : 0;
        const search = query.search?.trim();
        const searchRegex = search
            ? new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
            : null;

        const sortOrder = query.sortOrder === "desc" ? -1 : 1;

        const sortByRaw = (query.sortBy ?? "submittedAt").trim();

        // allowlist sort keys
        const SORT_MAP: Record<string, any> = {
            submittedAt: { "submission.submittedAt": sortOrder },
            updatedAt: { updatedAt: sortOrder },
            status: { "submission.status": sortOrder },
            activityTitle: { "activity.title": sortOrder },
            deadline: { deadline: sortOrder }
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
                                {
                                    case: {
                                        $and: [
                                            { $eq: ["$status", "SUBMITTED"] },
                                            { $eq: ["$rule.reward.applyWhen", "ON_SUBMISSION"] }
                                        ]
                                    },
                                    then: "$baseHp"
                                },
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
                    courseId: { $toString: "$courseId" },

                    activity: {
                        id: { $toString: "$activity._id" },
                        title: { $ifNull: ["$activity.title", ""] },
                        description: { $ifNull: ["$activity.description", ""] },
                        activityType: { $ifNull: ["$activity.activityType", "OTHER"] },
                        required_percentage: "activity.required_percentage"
                    },

                    deadline: "$rule.deadlineAt",

                    rule: {
                        isMandatory: "$rule.isMandatory",
                        allowLateSubmission: "$rule.allowLateSubmission",
                        submissionValidation: {
                            $ifNull: ["$rule.submissionValidation", ["TEXT"]],
                        },
                        lateRewardPolicy: "$rule.lateRewardPolicy",

                        reward: {
                            enabled: "$rule.reward.enabled",
                            type: "$rule.reward.type",
                            value: "$rule.reward.value",
                            applyWhen: "$rule.reward.applyWhen",
                            onlyWithinDeadline: "$rule.reward.onlyWithinDeadline",
                            allowLate: "$rule.reward.allowLate",
                            lateBehavior: "$rule.reward.lateBehavior",
                            minHpFloor: "$rule.reward.minHpFloor",
                            // required_percentage: "$rule.reward.required_percentage"
                        },

                        penalty: {
                            enabled: "$rule.penalty.enabled",
                            type: "$rule.penalty.type",
                            value: "$rule.penalty.value",
                            applyWhen: "$rule.penalty.applyWhen",
                            graceMinutes: "$rule.penalty.graceMinutes"
                        },

                        limits: {
                            minHp: "$rule.limits.minHp",
                            maxHp: "$rule.limits.maxHp"
                        }
                    },

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
            ...(limit > 0 ? [{ $limit: limit }] : []),
        ];

        const docs = await this.hpActivitySubmissionCollection.aggregate(pipeline).toArray();

        // return plainToInstance(StudentActivitySubmissionsViewDto, docs, {
        //     excludeExtraneousValues: true,
        //     enableImplicitConversion: true,
        // });

        return docs;
    }

    async list(query: ListSubmissionsQueryDto, opts?: { session?: ClientSession }): Promise<HpActivitySubmission[]> {
        await this.init();

        const page = query.page ?? 1;
        const limit = query.limit ?? 0;
        const skip = limit > 0 ? (page - 1) * limit : 0;

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

    async listSubmissionsBeforeDeadline(activityId: string): Promise<HpActivitySubmission[]> {
        await this.init();

        const ruleConfig = await this.hpRuleConfigsCollection.findOne({
            activityId: new ObjectId(activityId),
            isDeleted: { $ne: true }
        });

        if (!ruleConfig) {
            return [];
        }

        const graceMinutes = ruleConfig.penalty?.graceMinutes ?? 0;

        const effectiveDeadline = new Date(
            ruleConfig.deadlineAt.getTime() + graceMinutes * 60000
        );

        return this.hpActivitySubmissionCollection
            .find({
                activityId: new ObjectId(activityId),
                createdAt: { $lte: effectiveDeadline }
            })
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

    async getCountByStudentId(studentId: string, courseId: string, courseVersionId: string, cohortName: string): Promise<number> {
        await this.init();
        return await this.hpActivitySubmissionCollection.countDocuments({
            studentId: new ObjectId(studentId),
            courseId: new ObjectId(courseId),
            courseVersionId: new ObjectId(courseVersionId),
            cohort: cohortName
        });
    }

    async getLateSubmissionCountByStudentId(studentId: string, courseId: string, courseVersionId: string, cohortName: string): Promise<number> {
        await this.init();
        return await this.hpActivitySubmissionCollection.countDocuments({
            studentId: new ObjectId(studentId),
            courseId: new ObjectId(courseId),
            courseVersionId: new ObjectId(courseVersionId),
            cohort: cohortName,
            isLate: true
        });
    }

    async getLateSubmissionCount(cohortName: string, courseVersionId: string, session?: ClientSession): Promise<number> {
        await this.init();
        return await this.hpActivitySubmissionCollection.countDocuments({
            cohort: cohortName,
            courseVersionId: new ObjectId(courseVersionId),
            isLate: true
        }, { session });
    }

    async getPendingSubmissionsCount(cohortName: string, courseVersionId: string, session?: ClientSession): Promise<number> {
        await this.init();
        return await this.hpActivitySubmissionCollection.countDocuments({
            cohort: cohortName,
            courseVersionId: new ObjectId(courseVersionId),
            status: 'SUBMITTED'
        }, { session });
    }

    async getCompletedActivitiesCountByStudentId(studentId: string): Promise<Array<{ cohort: string, count: number }>> {
        await this.init();

        return await this.hpActivitySubmissionCollection.aggregate([
            {
                $match: {
                    studentId: new ObjectId(studentId),
                    status: { $in: ["SUBMITTED", "APPROVED"] },
                    isDeleted: { $ne: true }
                }
            },
            {
                $lookup: {
                    from: "hp_ledger",
                    let: { submissionId: "$_id", activityId: "$activityId" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $or: [
                                        { $eq: ["$submissionId", "$$submissionId"] },
                                        { $eq: ["$activityId", "$$activityId"] }
                                    ]
                                },
                                // Ensure it's for the same student
                                studentId: new ObjectId(studentId)
                            }
                        },
                        { $sort: { createdAt: -1 } },
                        { $limit: 1 }
                    ],
                    as: "latestLedger"
                }
            },
            {
                $unwind: "$latestLedger"
            },
            {
                $match: {
                    "latestLedger.direction": "CREDIT"
                }
            },
            {
                $group: {
                    _id: { cohort: "$cohort" },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    cohort: "$_id.cohort",
                    count: 1
                }
            }
        ]).toArray() as any;
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

    async getDailyActivityCount(
        cohortName: string, 
        courseVersionId: string, 
        startDate: Date, 
        endDate: Date, 
        session?: ClientSession
    ): Promise<number> {
        await this.init();
        
        const collection = this.hpActivitySubmissionCollection;

        const filter = {
            cohort: cohortName,
            courseVersionId: new ObjectId(courseVersionId),
            createdAt: {
                $gte: startDate,
                $lte: endDate
            }
        };

        const count = await collection.countDocuments(filter, { session });
        return count;
    }

    async getDailyActivityCountByStatus(
        cohortName: string,
        courseVersionId: string,
        startDate: Date,
        endDate: Date,
        status: string,
        session?: ClientSession
    ): Promise<number> {
        await this.init();
        
        const collection = this.hpActivitySubmissionCollection;

        const filter = {
            cohort: cohortName,
            courseVersionId: new ObjectId(courseVersionId),
            status: status as SubmissionStatus,
            createdAt: {
                $gte: startDate,
                $lte: endDate
            }
        };

        const count = await collection.countDocuments(filter, { session });
        return count;
    }

    async getUniqueStudentCountForCohort(
        cohortName: string,
        courseVersionId: string,
        session?: ClientSession
    ): Promise<number> {
        await this.init();
        
        const collection = this.hpActivitySubmissionCollection;

        const filter = {
            cohort: cohortName,
            courseVersionId: new ObjectId(courseVersionId)
        };

        const uniqueStudents = await collection.distinct('studentId', filter, { session });
        return uniqueStudents.length;
    }

    async getStudentProgressForCohort(
        cohortName: string,
        courseVersionId: string,
        session?: ClientSession
    ): Promise<{
        completed: number;
        inProgress: number;
        notStarted: number;
    }> {
        await this.init();
        
        const collection = this.hpActivitySubmissionCollection;

        // Get total activities for this cohort
        const totalActivities = await this.activityRepository.getCountByCohortName(cohortName, courseVersionId);
        
        // Get unique students
        const uniqueStudents = await collection.distinct('studentId', {
            cohort: cohortName,
            courseVersionId: new ObjectId(courseVersionId)
        }, { session });

        let completed = 0;
        let inProgress = 0;
        let notStarted = 0;

        for (const studentId of uniqueStudents) {
            // Get student's submissions
            const submissions = await collection.find({
                cohort: cohortName,
                courseVersionId: new ObjectId(courseVersionId),
                studentId
            }, { session }).toArray();

            const approvedCount = submissions.filter(s => s.status === 'APPROVED').length;
            const submittedCount = submissions.filter(s => s.status === 'SUBMITTED').length;

            if (approvedCount === totalActivities) {
                completed++;
            } else if (submittedCount > 0 || approvedCount > 0) {
                inProgress++;
            } else {
                notStarted++;
            }
        }

        return { completed, inProgress, notStarted };
    }
}