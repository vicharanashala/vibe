import { Course, CourseVersion } from "#root/modules/courses/classes/index.js";
import { CohortStudentItemDto, CohortStudentsListQueryDto } from "#root/modules/hpSystem/classes/validators/courseAndCohorts.js";
import { COHORT_OVERRIDES, ID } from "#root/modules/hpSystem/constants.js";
import { ICohortRepository } from "#root/modules/hpSystem/interfaces/ICohortsRepository.js";
import { ICohort, IEnrollment, IUserRepository, MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { plainToInstance } from "class-transformer";
import { CourseWithVersionsDto } from "#root/modules/hpSystem/classes/validators/courseAndCohorts.js";
import { inject, injectable } from "inversify";
import { ClientSession, Collection, ObjectId } from "mongodb";
import { HpActivity, HpLedger, HpResetMode } from "#root/modules/hpSystem/models.js";
import { HpActivitySubmission } from "#root/modules/hpSystem/classes/transformers/ActivitySubmission.js";
import { toObjectId } from "#root/modules/hpSystem/utils/toObjectId.js";
import { getHpLedgerOperationId } from "#root/modules/hpSystem/utils/getHpLedgerOperationId .js";
import { NotFoundError } from "routing-controllers";

@injectable()
export class CohortRepository implements ICohortRepository {
    private courseCollection: Collection<Course>;
    private courseVersionCollection: Collection<CourseVersion>;
    private enrollmentCollection: Collection<IEnrollment>;
    private cohortsCollection: Collection<ICohort>;
    private courseSettingsCollection: Collection<any>;
    private hpLedgerCollection: Collection<HpLedger>;
    private hpActivityCollection: Collection<HpActivity>;
    private hpActivitySubmissionCollection: Collection<HpActivitySubmission>;

    constructor(
        @inject(GLOBAL_TYPES.Database)
        private db: MongoDatabase,
        @inject(GLOBAL_TYPES.UserRepo) 
        private readonly userRepo: IUserRepository,
    ) { }

    private async init() {
        this.courseCollection = await this.db.getCollection<Course>('newCourse');
        this.courseVersionCollection = await this.db.getCollection<CourseVersion>(
            'newCourseVersion',
        );

        this.courseSettingsCollection = await this.db.getCollection<any>(
            'courseSettings',
        );

        this.enrollmentCollection = await this.db.getCollection<IEnrollment>(
            'enrollment',
        );

        this.cohortsCollection = await this.db.getCollection<ICohort>(
            'cohorts',
        );
        this.hpLedgerCollection = await this.db.getCollection<HpLedger>('hp_ledger');
        this.hpActivityCollection = await this.db.getCollection<HpActivity>('hp_activities');
        this.hpActivitySubmissionCollection = await this.db.getCollection<HpActivitySubmission>(
            'hp_activity_submissions',
        );

    }
async getCourseDetailsByVersionId(courseVersionId: string) {
    await this.init();

    if (!ObjectId.isValid(courseVersionId)) return null;

    const versionObjId = new ObjectId(courseVersionId);

    const pipeline = [
        {
            $match: {
                _id: versionObjId
            }
        },
        {
            $lookup: {
                from: "newCourse",
                localField: "courseId",
                foreignField: "_id",
                as: "course"
            }
        },
        { $unwind: "$course" },
        {
            $project: {
                _id: 0,
                courseName: "$course.name",
                courseDescription: "$course.description",
                versionName: "$version",
                versionDescription: "$description",
                totalItems: "$totalItems"
            }
        }
    ];

    const result = await this.courseVersionCollection.aggregate(pipeline).toArray();

    return result[0] || null;
}

    async getTotalStudentsCountForCourseVersion(courseVersionId: string): Promise<number> {
        await this.init();
        if (!ObjectId.isValid(courseVersionId)) return 0;
        return await this.enrollmentCollection.countDocuments({
            courseVersionId: new ObjectId(courseVersionId), isDeleted: { $ne: true },
        });
    }

    async getCohortsByVersionId(courseVersionId: string, isPublic?: boolean): Promise<ICohort[]> {
        await this.init();

        const orVersionMatch: any[] = [{ courseVersionId }];
        if (ObjectId.isValid(courseVersionId)) {
            orVersionMatch.push({ courseVersionId: new ObjectId(courseVersionId) });
        }

        const filter: any = { $or: orVersionMatch, isDeleted: { $ne: true } };
        if (typeof isPublic === "boolean") {
            // filter.isPublic = isPublic;
        }

        return await this.cohortsCollection
            .find(filter)
            .sort({ createdAt: 1 })
            .toArray();
    }

    async getCohortIdByCohortName(cohortName: string): Promise<string | null> {
        await this.init();

        const cohort = await this.cohortsCollection.findOne(
            { name: cohortName },
            { projection: { _id: 1 } }
        );
        return cohort?._id?.toString() ?? null;
    }

    async getCohortById(cohortId: string): Promise<ICohort | null> {
        await this.init();

        if (!ObjectId.isValid(cohortId)) return null;

        return await this.cohortsCollection.findOne({
            _id: new ObjectId(cohortId),
            isDeleted: { $ne: true },
        });
    }

    async resolveCohort(
        idOrName: string,
        courseId?: string,
        courseVersionId?: string,
        session?: ClientSession,
    ): Promise<ICohort | null> {
        await this.init();

        if (!idOrName) return null;

        // Helper to ensure we have a common format for comparison/assignment
        const toId = (val: any) => ObjectId.isValid(val) ? new ObjectId(val) : val;

        let cohort: ICohort | null = null;

        // 1. Try to resolve by ObjectId if valid
        if (ObjectId.isValid(idOrName)) {
            cohort = await this.cohortsCollection.findOne({
                _id: new ObjectId(idOrName),
                isDeleted: { $ne: true },
            }, { session });
        }

        // 2. Fallback to resolution by name if not found by ID
        if (!cohort) {
            const query: any = {
                name: idOrName,
                isDeleted: { $ne: true },
            };

            const isPseudoId = (id?: string) => id?.startsWith("00000000000000000");

            // If scoping IDs are provided, use them to ensure uniqueness
            // But SKIP if they are pseudoIDs (used as markers for legacy courses)
            if (courseId && !isPseudoId(courseId)) query.courseId = toId(courseId);
            if (courseVersionId && !isPseudoId(courseVersionId)) query.courseVersionId = toId(courseVersionId);

            cohort = await this.cohortsCollection.findOne(query, { session });
            
            // Final fallback for names: if scoped query fails, try searching by name only
            if (!cohort && !ObjectId.isValid(idOrName)) {
                 cohort = await this.cohortsCollection.findOne({ name: idOrName, isDeleted: { $ne: true } }, { session });
            }
        }

        if (cohort) {
            // ✅ PROFESSIONAL FALLBACK & INFERENCE:
            // If the database record is missing scoping IDs (common in older dynamic cohorts),
            // but they were provided in the call context (URL params), attach them.
            if (!cohort.courseId && courseId) cohort.courseId = toId(courseId);
            if (!cohort.courseVersionId && courseVersionId) cohort.courseVersionId = toId(courseVersionId);

            // ✅ SMART INFERENCE:
            // If we still don't have a courseId but we DO have a courseVersionId (either from doc or argument),
            // perform a one-time lookup to find the parent courseId.
            if (!cohort.courseId && cohort.courseVersionId) {
                const versionDoc = await this.courseVersionCollection.findOne(
                    { _id: toId(cohort.courseVersionId) },
                    { projection: { courseId: 1 }, session }
                );
                if (versionDoc?.courseId) {
                    cohort.courseId = toId(versionDoc.courseId);
                }
            }
        }

        return cohort;
    }

    async getTotalStudentsCountForCohort(courseVersionId: string, cohortId: string): Promise<number> {
        await this.init();

        const orVersionMatch: any[] = [{ courseVersionId }];
        if (ObjectId.isValid(courseVersionId)) {
            orVersionMatch.push({ courseVersionId: new ObjectId(courseVersionId) });
        }

        const orCohortMatch: any[] = [{ cohortId }];
        if (ObjectId.isValid(cohortId)) {
            orCohortMatch.push({ cohortId: new ObjectId(cohortId) });
        }

        return await this.enrollmentCollection.countDocuments({
            $or: orVersionMatch,
            $and: [{ $or: orCohortMatch }],
            isDeleted: { $ne: true },
        });
    }

    async getStudentsForExistingCohortByVersionId(
        courseVersionId: string,
        query: CohortStudentsListQueryDto
    ): Promise<CohortStudentItemDto[]> {
        await this.init();

        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;

        const search = query.search?.trim();
        const sortOrder = query.sortOrder === "desc" ? -1 : 1;


        const sortByRaw = (query.sortBy ?? "name").trim();
        const SORT_MAP: Record<string, Record<string, 1 | -1>> = {
            name: { name: sortOrder },
            email: { email: sortOrder },
            completionPercentage: { completionPercentage: sortOrder },
            totalHp: { totalHp: sortOrder },
        };

        const sortStage = SORT_MAP[sortByRaw] ?? { name: sortOrder };

        const orVersionMatch: any[] = [{ courseVersionId }];
        if (ObjectId.isValid(courseVersionId)) {
            orVersionMatch.push({ courseVersionId: new ObjectId(courseVersionId) });
        }

        const searchRegex = search ? new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;

        const pipeline: any[] = [
            {
                $match: {
                    $or: orVersionMatch,
                    status: { $ne: "inactive" },
                    role: "STUDENT",
                    isDeleted: { $ne: true },
                },
            },

            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "user",
                },
            },
            { $unwind: { path: "$user", preserveNullAndEmptyArrays: false } },

            {
                $addFields: {
                    fullName: {
                        $trim: {
                            input: {
                                $concat: [
                                    { $ifNull: ["$user.firstName", ""] },
                                    " ",
                                    { $ifNull: ["$user.lastName", ""] },
                                ],
                            },
                        },
                    },
                },
            },

            ...(searchRegex
                ? [
                    {
                        $match: {
                            $or: [
                                { "user.firstName": searchRegex },
                                { "user.lastName": searchRegex },
                                { "user.email": searchRegex },
                                { fullName: searchRegex },
                            ],
                        },
                    },
                ]
                : []),

            {
                $project: {
                    _id: { $toString: "$user._id" },
                    email: "$user.email",
                    name: "$fullName",
                    completionPercentage: { $ifNull: ["$percentCompleted", 0] },
                    totalHp: { $ifNull: ["$hpPoints", 0] },
                },
            },

            { $sort: sortStage },
            { $skip: skip },
            { $limit: limit },
        ];

        const docs = await this.enrollmentCollection.aggregate(pipeline).toArray();

        return plainToInstance(CohortStudentItemDto, docs, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true,
        });
    }


    async getStudentsForCohortByVersionAndCohortName(
        courseVersionId: string,
        cohortId: string
    ): Promise<CohortStudentItemDto[]> {
        await this.init();

        const orVersionMatch: any[] = [{ courseVersionId }];
        if (ObjectId.isValid(courseVersionId)) {
            orVersionMatch.push({ courseVersionId: new ObjectId(courseVersionId) });
        }
        const cohortMatch = {
            $or: [
                { cohortId: { $exists: false } },
                { cohortId: null },
                ...(ObjectId.isValid(cohortId) ? [{ cohortId: new ObjectId(cohortId) }] : [{ cohortId: cohortId }])
            ]
        };

        const pipeline: any[] = [
            {
                $match: {
                    $and: [
                        { $or: orVersionMatch },
                        { status: "ACTIVE" },
                        { role: 'STUDENT' },
                        { isDeleted: { $ne: true } },
                        cohortMatch
                    ],
                },
            },
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "user",
                },
            },
            { $unwind: { path: "$user", preserveNullAndEmptyArrays: false } },
            {
                $project: {
                    _id: { $toString: "$user._id" },
                    enrollmentId: { $toString: "$_id" },
                    email: "$user.email",
                    name: {
                        $trim: {
                            input: {
                                $concat: [
                                    { $ifNull: ["$user.firstName", ""] },
                                    " ",
                                    { $ifNull: ["$user.lastName", ""] },
                                ],
                            },
                        },
                    },
                    completionPercentage: {
                        $ifNull: ["$percentCompleted", 0],
                    },
                    totalHp: { $ifNull: ["$hpPoints", 0] },
                },
            },
            { $sort: { name: 1 } },
        ];

        const docs = await this.enrollmentCollection.aggregate(pipeline).toArray();

        return plainToInstance(CohortStudentItemDto, docs, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true,
        });
    }


    async getStudentsForCohortByCohortId(
        courseVersionId: string,
        cohortId: string,
        query: CohortStudentsListQueryDto
    ): Promise<CohortStudentItemDto[]> {
        await this.init();

        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;
        const status = query.status;

        const search = query.search?.trim();
        const sortOrder = query.sortOrder === "desc" ? -1 : 1;

        const sortByRaw = (query.sortBy ?? "name").trim();
        const SORT_MAP: Record<string, Record<string, 1 | -1>> = {
            name: { name: sortOrder },
            email: { email: sortOrder },
            completionPercentage: { completionPercentage: sortOrder },
            totalHp: { totalHp: sortOrder },
        };

        const sortStage = SORT_MAP[sortByRaw] ?? { name: sortOrder };

        const orVersionMatch: any[] = [{ courseVersionId }];
        if (ObjectId.isValid(courseVersionId)) {
            orVersionMatch.push({ courseVersionId: new ObjectId(courseVersionId) });
        }

        const orCohortMatch: any[] = [{ cohortId }];
        if (ObjectId.isValid(cohortId)) {
            orCohortMatch.push({ cohortId: new ObjectId(cohortId) });
        }

        const searchRegex = search ? new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;

        const pipeline: any[] = [
            {
                $match: {
                    $and: [
                        { $or: orVersionMatch },
                        { $or: orCohortMatch },
                    ],
                    isDeleted: { $ne: true },
                },
            },

            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "user",
                },
            },
            { $unwind: { path: "$user", preserveNullAndEmptyArrays: false } },

            {
                $addFields: {
                    fullName: {
                        $trim: {
                            input: {
                                $concat: [
                                    { $ifNull: ["$user.firstName", ""] },
                                    " ",
                                    { $ifNull: ["$user.lastName", ""] },
                                ],
                            },
                        },
                    },
                },
            },

            ...(searchRegex
                ? [
                    {
                        $match: {
                            $or: [
                                { "user.firstName": searchRegex },
                                { "user.lastName": searchRegex },
                                { "user.email": searchRegex },
                                { fullName: searchRegex },
                            ],
                        },
                    },
                ]
                : []),
            {
                $lookup: {
                    from: "cohorts",
                    localField: "cohortId",
                    foreignField: "_id",
                    as: "cohort",
                },
            },
            {
                $unwind: {
                    path: "$cohort",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $addFields: {
                    safeHp: { $ifNull: ["$cohort.safeHp", 0] },
                },
            },

            ...(status === "SAFE"
                ? [
                    {
                        $match: {
                            $expr: {
                                $gte: [
                                    { $ifNull: ["$hpPoints", 0] },
                                    "$safeHp",
                                ],
                            },
                        },
                    },
                ]
                : status === "UNSAFE"
                    ? [
                        {
                            $match: {
                                $expr: {
                                    $lt: [
                                        { $ifNull: ["$hpPoints", 0] },
                                        "$safeHp",
                                    ],
                                },
                            },
                        },
                    ]
                    : []),

            {
                $project: {
                    _id: { $toString: "$user._id" },
                    email: "$user.email",
                    name: "$fullName",
                    completionPercentage: { $ifNull: ["$percentCompleted", 0] },
                    totalHp: { $ifNull: ["$hpPoints", 0] },

                    isSafe: {
                        $gte: [
                            { $ifNull: ["$hpPoints", 0] },
                            { $ifNull: ["$safeHp", 0] },
                        ],
                    },
                },
            },

            { $sort: sortStage },
            { $skip: skip },
            { $limit: limit },
        ];

        const docs = await this.enrollmentCollection.aggregate(pipeline).toArray();

        return plainToInstance(CohortStudentItemDto, docs, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true,
        });
    }




    async findEnrollment(
        userId: string | ObjectId,
        courseId: string,
        courseVersionId: string,
        cohortId: string,
        session?: ClientSession,
    ): Promise<IEnrollment | null> {
        await this.init();

        const normalizedUserId =
            typeof userId === "string" && ObjectId.isValid(userId)
                ? [userId, new ObjectId(userId)]
                : [userId];

        const normalizedCourseId = ObjectId.isValid(courseId)
            ? [courseId, new ObjectId(courseId)]
            : [courseId];

        const normalizedCourseVersionId = ObjectId.isValid(courseVersionId)
            ? [courseVersionId, new ObjectId(courseVersionId)]
            : [courseVersionId];

        const normalizedCohortId = ObjectId.isValid(cohortId)
            ? [cohortId, new ObjectId(cohortId)]
            : [cohortId];

        const query: any = {
            userId: { $in: normalizedUserId },
            courseId: { $in: normalizedCourseId },
            courseVersionId: { $in: normalizedCourseVersionId },
            isDeleted: { $ne: true },
            $or: [
                { cohortId: { $in: normalizedCohortId } },
                { cohortId: { $exists: false } },
                { cohortId: null }
            ]
        };

        return await this.enrollmentCollection.findOne(query, { session });
    }

    /**
     * Checks if a user has an active STUDENT enrollment for a given courseVersionId.
     */
    async isStudentEnrolledInVersion(userId: string, courseVersionId: string): Promise<boolean> {
        await this.init();
        const userObjId = ObjectId.isValid(userId) ? new ObjectId(userId) : null;
        const versionObjId = ObjectId.isValid(courseVersionId) ? new ObjectId(courseVersionId) : null;

        const match: any = {
            userId: userObjId ? { $in: [userId, userObjId] } : userId,
            courseVersionId: versionObjId
                ? { $in: [courseVersionId, versionObjId] }
                : courseVersionId,
            role: "STUDENT",
            status: "ACTIVE",
            isDeleted: { $ne: true },
        };

        const count = await this.enrollmentCollection.countDocuments(match);
        return count > 0;
    }

    /**
     * Fetches all active STUDENT enrollments for a user, including cohortName from the cohorts collection.
     */
    async getStudentActiveEnrollments(userId: string): Promise<
        Array<{
            courseId: string;
            courseVersionId: string;
            cohortId?: string;
            cohortName?: string;
            percentCompleted?: number;
        }>
    > {
        await this.init();
        const userObjId = new ObjectId(userId);

        const pipeline: any[] = [
            {
                $match: {
                    userId: { $in: [userId, userObjId] },
                    role: "STUDENT",
                    status: "ACTIVE",
                    isDeleted: { $ne: true },
                },
            },
            {
                $lookup: {
                    from: "cohorts",
                    localField: "cohortId",
                    foreignField: "_id",
                    as: "cohort",
                    pipeline: [{ $project: { name: 1 } }],
                },
            },
            { $unwind: { path: "$cohort", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 0,
                    courseId: { $toString: "$courseId" },
                    courseVersionId: { $toString: "$courseVersionId" },
                    cohortId: {
                        $cond: [
                            { $ifNull: ["$cohortId", false] },
                            { $toString: "$cohortId" },
                            null,
                        ],
                    },
                    cohortName: "$cohort.name",
                    percentCompleted: 1,
                },
            },
        ];

        return (await this.enrollmentCollection.aggregate(pipeline).toArray()) as any;
    }

    async getStudentTotalHpAcrossEnrollments(userId: string): Promise<number> {
        await this.init();
        const userObjId = new ObjectId(userId);

        const overridePairs = Object.values(COHORT_OVERRIDES).map(o => ({
            courseId: new ObjectId(o.courseId),
            courseVersionId: new ObjectId(o.versionId),
        }));

        const result = await this.enrollmentCollection.aggregate([
            {
                $match: {
                    userId: { $in: [userId, userObjId] },
                    role: "STUDENT",
                    status: "ACTIVE",
                    isDeleted: { $ne: true },
                },
            },

            {
                $lookup: {
                    from: "courseSettings",
                    let: { versionId: "$courseVersionId" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$courseVersionId", "$$versionId"] },
                                        { $eq: ["$settings.hpSystem", true] }
                                    ]
                                }
                            }
                        },
                        { $project: { _id: 1 } }
                    ],
                    as: "courseSettingsDoc",
                },
            },

            {
                $addFields: {
                    isOverride: {
                        $in: [
                            { courseId: "$courseId", courseVersionId: "$courseVersionId" },
                            overridePairs
                        ]
                    }
                }
            },

            {
                $match: {
                    $or: [
                        { isOverride: true },
                        { "courseSettingsDoc.0": { $exists: true } }
                    ]
                }
            },

            {
                $group: {
                    _id: null,
                    totalHp: { $sum: { $ifNull: ["$hpPoints", 0] } },
                },
            },
        ]).toArray();

        return result[0]?.totalHp ?? 0;
    }

    async setHPForEnrollment(
        userId: ID,
        courseId: ID,
        courseVersionId: ID,
        cohortId: string,
        amount: number,
        session?: ClientSession,
    ): Promise<boolean> {
        await this.init();

        const query: any = {
            userId: { $in: [userId, new ObjectId(userId)] },
            courseId: { $in: [courseId, new ObjectId(courseId)] },
            courseVersionId: { $in: [courseVersionId, new ObjectId(courseVersionId)] },
            isDeleted: { $ne: true },
            $or: [
                { cohortId: { $in: [cohortId, new ObjectId(cohortId)] } },
                { cohortId: { $exists: false } },
                { cohortId: null }
            ]
        };

        const updateResult = await this.enrollmentCollection.updateOne(
            query,
            {
                $set: {
                    hpPoints: Math.max(0, amount),
                    updatedAt: new Date(),
                },
            },
            { session }
        );

        return updateResult.matchedCount > 0;
    }

    async getDynamicCoursesWithVersions(session?: ClientSession): Promise<CourseWithVersionsDto[]> {
        await this.init();

        const pipeline: any[] = [
            // 1. Get all active & public course versions that have hpSystem enabled
            {
                $match: {
                    "settings.hpSystem": true,
                    //"settings.isPublic": true, // We might need this if we shouldn't show private courses, ask later if needed.
                }
            },
            // 2. Lookup the courseVersion details
            {
                $lookup: {
                    from: "newCourseVersion",
                    localField: "courseVersionId",
                    foreignField: "_id",
                    as: "versionDetails"
                }
            },
            { $unwind: "$versionDetails" },
            // Only active versions
            {
                $match: {
                    "versionDetails.isDeleted": { $ne: true },
                    "versionDetails.versionStatus": { $in: ["active", "published"] }
                }
            },
            // 3. Lookup the parent Course
            {
                $lookup: {
                    from: "newCourse",
                    localField: "versionDetails.courseId",
                    foreignField: "_id",
                    as: "courseDetails"
                }
            },
            { $unwind: "$courseDetails" },
            {
                $match: {
                    "courseDetails.isDeleted": { $ne: true }
                }
            },
            // 4. Lookup cohorts for this version to count them
            {
                $lookup: {
                    from: "cohorts",
                    let: { versionId: "$courseVersionId" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$courseVersionId", "$$versionId"] },
                                        { $ne: ["$isDeleted", true] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: "versionCohorts"
                }
            },
            // 5. Group by Course structure
            {
                $group: {
                    _id: "$courseDetails._id",
                    courseName: { $first: "$courseDetails.name" },
                    versions: {
                        $push: {
                            courseVersionId: { $toString: "$versionDetails._id" },
                            versionName: "$versionDetails.version",
                            totalCohorts: { $size: "$versionCohorts" },
                            createdAt: "$versionDetails.createdAt"
                        }
                    }
                }
            },
            // 6. Project to the expected DTO shape
            {
                $project: {
                    _id: 0,
                    courseId: { $toString: "$_id" },
                    courseName: 1,
                    versions: 1
                }
            }
        ];

        return await this.courseSettingsCollection.aggregate<CourseWithVersionsDto>(pipeline, { session }).toArray();
    }

    async getInstructorActiveEnrollments(userId: string): Promise<Array<{ courseId: string; courseVersionId: string; cohortId?: string }>> {
        await this.init();
        const userObjId = new ObjectId(userId);

        const enrollments = await this.enrollmentCollection.find({
            userId: { $in: [userId, userObjId] },
            role: "INSTRUCTOR",
            isDeleted: { $ne: true }
        }).toArray();

        return enrollments.map(e => ({
            courseId: e.courseId?.toString() ?? "",
            courseVersionId: e.courseVersionId?.toString() ?? "",
            cohortId: e.cohortId?.toString()
        }));
    }

    async getTotalHpDistributedByCohort(
        courseVersionId: string,
        cohortId?: string
    ): Promise<number> {
        await this.init();

        const match: any = {};

        if (ObjectId.isValid(courseVersionId)) {
            match.courseVersionId = new ObjectId(courseVersionId);
        } else {
            match.courseVersionId = courseVersionId;
        }

        if (cohortId) {
            if (ObjectId.isValid(cohortId)) {
                match.cohortId = new ObjectId(cohortId);
            } else {
                match.cohortId = cohortId;
            }
        }

        const result = await this.enrollmentCollection
            .aggregate([
                { $match: match },
                {
                    $group: {
                        _id: null,
                        totalHp: {
                            $sum: { $ifNull: ["$hpPoints", 0] },
                        },
                    },
                },
            ])
            .toArray();

        return result[0]?.totalHp ?? 0;
    }

    async updateCohortNameAcrossDB(
        courseVersionId: string,
        oldCohortName: string,
        newCohortName: string,
    ): Promise<void> {
        await this.init();

        const match: any = { cohort: oldCohortName };
        if (ObjectId.isValid(courseVersionId)) {
            match.courseVersionId = new ObjectId(courseVersionId);
        } else {
            match.courseVersionId = courseVersionId;
        }

        const filter = match;

        const update = {
            $set: { cohort: newCohortName },
        };

        await Promise.all([
            this.hpActivityCollection.updateMany(filter, update),
            this.hpActivitySubmissionCollection.updateMany(filter, update),
            this.hpLedgerCollection.updateMany(filter, update),
        ]);
    }

    async getCurrentHpPointsByCohortId(
        studentId: string,
        courseId: string,
        courseVersionId: string,
        cohortId: string,
        session?: ClientSession
    ): Promise<number> {
        await this.init();

        const match: any = {
            isDeleted: { $ne: true }
        };

        if (ObjectId.isValid(studentId)) {
            match.userId = new ObjectId(studentId);
        } else {
            match.userId = studentId;
        }

        if (ObjectId.isValid(courseId)) {
            match.courseId = new ObjectId(courseId);
        } else {
            match.courseId = courseId;
        }

        if (ObjectId.isValid(courseVersionId)) {
            match.courseVersionId = new ObjectId(courseVersionId);
        } else {
            match.courseVersionId = courseVersionId;
        }

        if (cohortId) {
            const orMatch: any[] = [
                { cohortId: { $exists: false } },
                { cohortId: null }
            ];
            if (ObjectId.isValid(cohortId)) {
                orMatch.push({ cohortId: new ObjectId(cohortId) });
            } else {
                orMatch.push({ cohortId: cohortId });
            }
            match.$or = orMatch;
        }

        const enrollment = await this.enrollmentCollection.findOne(
            match,
            { session }
        );


        return enrollment?.hpPoints ?? 0;
    }

    async getCourseVersionNameById(versionId: string): Promise<string> {
        await this.init();

        if (!ObjectId.isValid(versionId)) return versionId;

        const doc = await this.courseVersionCollection.findOne(
            { _id: new ObjectId(versionId) },
            { projection: { version: 1 } }
        );

        if (!doc) {
            throw new Error("Course version not found");
        }

        return doc.version;
    }

    async resetHpforCohort(
    courseVersionId: string,
    cohortId: string,
    cohortName:string,
    targetHp: number,
    mode: HpResetMode,
    triggeredByUserId: string,
    session?: ClientSession,
    ): Promise<number> {

    const orVersionMatch: any[] = [{ courseVersionId }];
    if (ObjectId.isValid(courseVersionId)) {
      orVersionMatch.push({ courseVersionId: new ObjectId(courseVersionId) });
    }

    const orCohortMatch: any[] = [];
    if (cohortId && ObjectId.isValid(cohortId)) {
      orCohortMatch.push({ cohortId: new ObjectId(cohortId) });
      orCohortMatch.push({ cohortId: cohortId });
    } else {
      orCohortMatch.push({ cohortId: { $exists: false } });
      orCohortMatch.push({ cohortId: null });
    }

    const filter: any = {
      isDeleted: { $ne: true },
      $or: orVersionMatch,
      $and: [{ $or: orCohortMatch }],
    };

    if (mode === 'ONLY_ZERO_HP') {
        filter.$or = [
        {hpPoints: 0},
        {hpPoints: {$exists: false}},
        {hpPoints: null},
        ];
    } else if (mode === 'ONLY_WITH_HP') {
        filter.hpPoints = {$gt: 0};
    }

    // ✅ STEP 1: Fetch students
    const students = await this.enrollmentCollection
        .find(filter, { session })
        .toArray();

    if (!students.length) return 0;

    const userIds = students.map(s => s.userId.toString());

    const users = await this.userRepo.getUsersByIds(userIds)

    const userMap = new Map(users.map(u => [u._id.toString(), u.email]));

    const bulkEnrollmentOps = [];
    const ledgerDocs = [];
    const modeTextMap = {
        ALL: "all students in the cohort",
        ONLY_ZERO_HP: "students with no HP",
        ONLY_WITH_HP: "students with existing HP",
    };

    for (const student of students) {
        if(student.isDeleted)
            continue;
        const currentHp = student.hpPoints ?? 0;
        const diff = targetHp - currentHp;

        // skip if no change
        if (diff === 0) continue;

        const direction = diff > 0 ? 'CREDIT' : 'DEBIT';

        // ✅ Ledger entry
        ledgerDocs.push({
            courseId: student.courseId,
            courseVersionId: student.courseVersionId,
            cohort: cohortName,

            studentId: student.userId,
            studentEmail: userMap.get(student.userId.toString()),

            activityId: null,
            submissionId: null,

            eventType: 'RESET',
            direction,
            amount: Math.abs(diff),

            calc: {
                ruleType: 'ABSOLUTE',
                absolutePoints: targetHp,
                baseHpAtTime: currentHp,
                computedAmount: currentHp+diff,
                reasonCode: 'HP_RESET',
            },

            links: null,

            meta: {
                triggeredBy: 'TEACHER',
                triggeredByUserId: toObjectId(triggeredByUserId,"triggeredByUserId"),
                operationId: getHpLedgerOperationId(mode),
                note: `Instructor reset student's HP from ${currentHp} to ${targetHp} for ${modeTextMap[mode]}.`
            },

            createdAt: new Date(),
        });

        bulkEnrollmentOps.push({
        updateOne: {
            filter: { _id: student._id },
            update: {
            $set: {
                hpPoints: targetHp,
                updatedAt: new Date(),
            },
            },
        },
        });
    }

    if (ledgerDocs.length) {
        await this.hpLedgerCollection.insertMany(ledgerDocs, { session });
    }

    async tempRes() {
        await this.init();


        ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // TO GET SINGLE COURSE ENROLLMENT AND WATCHHOURS RELATED DATA


        // return await this.courseVersionCollection.aggregate([
        //     { $match: { _id: new ObjectId("6981df886e100cfe04f9c4ae") } },

        //     {
        //         $lookup: {
        //             from: "newCourse",
        //             let: { cid: new ObjectId("6981df886e100cfe04f9c4ad") },
        //             pipeline: [
        //                 { $match: { $expr: { $eq: ["$_id", "$$cid"] } } },
        //                 { $project: { _id: 0, name: 1 } }
        //             ],
        //             as: "courseDoc"
        //         }
        //     },

        //     { $unwind: "$modules" },
        //     { $unwind: "$modules.sections" },
        //     {
        //         $project: {
        //             version: 1,
        //             itemsGroupId: {
        //                 $cond: [
        //                     { $eq: [{ $type: "$modules.sections.itemsGroupId" }, "string"] },
        //                     {
        //                         $convert: {
        //                             input: "$modules.sections.itemsGroupId",
        //                             to: "objectId",
        //                             onError: null,
        //                             onNull: null
        //                         }
        //                     },
        //                     "$modules.sections.itemsGroupId"
        //                 ]
        //             },
        //             courseName: { $arrayElemAt: ["$courseDoc.name", 0] }
        //         }
        //     },
        //     {
        //         $group: {
        //             _id: "$_id",
        //             version: { $first: "$version" },
        //             courseName: { $first: "$courseName" },
        //             groupIds: { $addToSet: "$itemsGroupId" }
        //         }
        //     },

        //     {
        //         $lookup: {
        //             from: "itemsGroup",
        //             localField: "groupIds",
        //             foreignField: "_id",
        //             as: "groups"
        //         }
        //     },

        //     {
        //         $unwind: {
        //             path: "$groups",
        //             preserveNullAndEmptyArrays: true
        //         }
        //     },
        //     {
        //         $unwind: {
        //             path: "$groups.items",
        //             preserveNullAndEmptyArrays: true
        //         }
        //     },

        //     {
        //         $group: {
        //             _id: "$_id",
        //             courseName: { $first: "$courseName" },
        //             version: { $first: "$version" },
        //             quizIds: {
        //                 $addToSet: {
        //                     $cond: [
        //                         { $eq: ["$groups.items.type", "QUIZ"] },
        //                         {
        //                             $cond: [
        //                                 { $eq: [{ $type: "$groups.items._id" }, "string"] },
        //                                 {
        //                                     $convert: {
        //                                         input: "$groups.items._id",
        //                                         to: "objectId",
        //                                         onError: null,
        //                                         onNull: null
        //                                     }
        //                                 },
        //                                 "$groups.items._id"
        //                             ]
        //                         },
        //                         null
        //                     ]
        //                 }
        //             }
        //         }
        //     },

        //     {
        //         $addFields: {
        //             quizIds: {
        //                 $filter: {
        //                     input: { $ifNull: ["$quizIds", []] },
        //                     as: "q",
        //                     cond: { $ne: ["$$q", null] }
        //                 }
        //             }
        //         }
        //     },

        //     {
        //         $lookup: {
        //             from: "enrollment",
        //             let: {
        //                 cid: new ObjectId("6981df886e100cfe04f9c4ad"),
        //                 vid: "$_id",
        //                 qids: "$quizIds"
        //             },
        //             pipeline: [
        //                 {
        //                     $match: {
        //                         $expr: {
        //                             $and: [
        //                                 { $eq: ["$courseId", "$$cid"] },
        //                                 { $eq: ["$courseVersionId", "$$vid"] }
        //                             ]
        //                         }
        //                     }
        //                 },

        //                 {
        //                     $lookup: {
        //                         from: "users",
        //                         let: { uid: "$userId" },
        //                         pipeline: [
        //                             { $match: { $expr: { $eq: ["$_id", "$$uid"] } } },
        //                             { $project: { _id: 0, firstName: 1, lastName: 1 } }
        //                         ],
        //                         as: "userDoc"
        //                     }
        //                 },
        //                 {
        //                     $addFields: {
        //                         userName: {
        //                             $trim: {
        //                                 input: {
        //                                     $concat: [
        //                                         { $ifNull: [{ $arrayElemAt: ["$userDoc.firstName", 0] }, ""] },
        //                                         " ",
        //                                         { $ifNull: [{ $arrayElemAt: ["$userDoc.lastName", 0] }, ""] }
        //                                     ]
        //                                 }
        //                             }
        //                         }
        //                     }
        //                 },

        //                 {
        //                     $lookup: {
        //                         from: "quiz_attempts",
        //                         let: { qids: "$$qids", uid: "$userId" },
        //                         pipeline: [
        //                             {
        //                                 $addFields: {
        //                                     quizObjId: {
        //                                         $cond: [
        //                                             { $eq: [{ $type: "$quizId" }, "string"] },
        //                                             {
        //                                                 $convert: {
        //                                                     input: "$quizId",
        //                                                     to: "objectId",
        //                                                     onError: null,
        //                                                     onNull: null
        //                                                 }
        //                                             },
        //                                             "$quizId"
        //                                         ]
        //                                     }
        //                                 }
        //                             },
        //                             {
        //                                 $match: {
        //                                     $expr: {
        //                                         $and: [
        //                                             { $eq: ["$userId", "$$uid"] },
        //                                             { $in: ["$quizObjId", "$$qids"] }
        //                                         ]
        //                                     }
        //                                 }
        //                             },
        //                             { $count: "cnt" }
        //                         ],
        //                         as: "quizAttemptsAgg"
        //                     }
        //                 },

        //                 {
        //                     $lookup: {
        //                         from: "watchTime",
        //                         let: { uid: "$userId", cid: "$courseId", vid: "$courseVersionId" },
        //                         pipeline: [
        //                             {
        //                                 $match: {
        //                                     $expr: {
        //                                         $and: [
        //                                             { $eq: ["$userId", "$$uid"] },
        //                                             { $eq: ["$courseId", "$$cid"] },
        //                                             { $eq: ["$courseVersionId", "$$vid"] },
        //                                             { $ne: ["$endTime", null] },
        //                                             { $ne: ["$isNotPure", true] }
        //                                         ]
        //                                     }
        //                                 }
        //                             },
        //                             {
        //                                 $group: {
        //                                     _id: null,
        //                                     totalMs: { $sum: { $subtract: ["$endTime", "$startTime"] } }
        //                                 }
        //                             },
        //                             {
        //                                 $project: {
        //                                     _id: 0,
        //                                     totalWatchHours: {
        //                                         $round: [{ $divide: ["$totalMs", 1000 * 60 * 60] }, 2]
        //                                     }
        //                                 }
        //                             }
        //                         ],
        //                         as: "watchAgg"
        //                     }
        //                 },

        //                 {
        //                     $project: {
        //                         _id: 0,
        //                         userId: { $toString: "$userId" },
        //                         userName: 1,
        //                         enrolledAt: {
        //                             $dateToString: {
        //                                 date: "$enrollmentDate",
        //                                 format: "%d-%m-%Y %H:%M",
        //                                 timezone: "Asia/Kolkata"
        //                             }
        //                         },
        //                         percentCompleted: 1,
        //                         completedItemsCount: 1,
        //                         status: 1,
        //                         isDeleted: 1,
        //                         isInactiveUser: {
        //                             $cond: [
        //                                 {
        //                                     $or: [
        //                                         { $eq: ["$isDeleted", true] },
        //                                         { $eq: ["$status", "INACTIVE"] }
        //                                     ]
        //                                 },
        //                                 true,
        //                                 false
        //                             ]
        //                         },
        //                         totalQuizAttempts: {
        //                             $ifNull: [{ $arrayElemAt: ["$quizAttemptsAgg.cnt", 0] }, 0]
        //                         },
        //                         totalWatchHours: {
        //                             $ifNull: [{ $arrayElemAt: ["$watchAgg.totalWatchHours", 0] }, 0]
        //                         }
        //                     }
        //                 }
        //             ],
        //             as: "enrollments"
        //         }
        //     },

        //     {
        //         $addFields: {
        //             totalEnrollments: { $size: { $ifNull: ["$enrollments", []] } },
        //             totalWatchTimeHours: {
        //                 $round: [
        //                     {
        //                         $sum: {
        //                             $map: {
        //                                 input: { $ifNull: ["$enrollments", []] },
        //                                 as: "e",
        //                                 in: { $ifNull: ["$$e.totalWatchHours", 0] }
        //                             }
        //                         }
        //                     },
        //                     2
        //                 ]
        //             }
        //         }
        //     },

        //     {
        //         $unwind: {
        //             path: "$enrollments",
        //             preserveNullAndEmptyArrays: true
        //         }
        //     },

        //     {
        //         $project: {
        //             _id: 0,
        //             // course: "$courseName",
        //             // courseName: "$courseName",
        //             // version: "$version.version",
        //             // totalEnrollments: 1,
        //             // totalWatchTimeHours: 1,
        //             // quizIds: 1,

        //             userId: "$enrollments.userId",
        //             userName: "$enrollments.userName",
        //             enrolledAt: "$enrollments.enrolledAt",
        //             percentCompleted: "$enrollments.percentCompleted",
        //             completedItemsCount: "$enrollments.completedItemsCount",
        //             status: "$enrollments.status",
        //             isDeleted: "$enrollments.isDeleted",
        //             isInactiveUser: "$enrollments.isInactiveUser",
        //             totalQuizAttempts: "$enrollments.totalQuizAttempts",
        //             totalWatchHours: "$enrollments.totalWatchHours"
        //         }
        //     }
        // ]).toArray();






        // SINGLE COURSE ENROLLMENTS ITEM WISE WATCH HOURS DATA

        // return await this.courseVersionCollection.aggregate([
        //     { $match: { _id: new ObjectId("6981df886e100cfe04f9c4ae") } },

        //     {
        //         $lookup: {
        //             from: "newCourse",
        //             let: { cid: new ObjectId("6981df886e100cfe04f9c4ad") },
        //             pipeline: [
        //                 { $match: { $expr: { $eq: ["$_id", "$$cid"] } } },
        //                 { $project: { _id: 0, name: 1 } }
        //             ],
        //             as: "courseDoc"
        //         }
        //     },

        //     { $unwind: "$modules" },
        //     { $unwind: "$modules.sections" },
        //     {
        //         $project: {
        //             version: 1,
        //             itemsGroupId: {
        //                 $cond: [
        //                     { $eq: [{ $type: "$modules.sections.itemsGroupId" }, "string"] },
        //                     {
        //                         $convert: {
        //                             input: "$modules.sections.itemsGroupId",
        //                             to: "objectId",
        //                             onError: null,
        //                             onNull: null
        //                         }
        //                     },
        //                     "$modules.sections.itemsGroupId"
        //                 ]
        //             },
        //             courseName: { $arrayElemAt: ["$courseDoc.name", 0] }
        //         }
        //     },
        //     {
        //         $group: {
        //             _id: "$_id",
        //             version: { $first: "$version" },
        //             courseName: { $first: "$courseName" },
        //             groupIds: { $addToSet: "$itemsGroupId" }
        //         }
        //     },

        //     {
        //         $lookup: {
        //             from: "itemsGroup",
        //             localField: "groupIds",
        //             foreignField: "_id",
        //             as: "groups"
        //         }
        //     },

        //     {
        //         $unwind: {
        //             path: "$groups",
        //             preserveNullAndEmptyArrays: true
        //         }
        //     },
        //     {
        //         $unwind: {
        //             path: "$groups.items",
        //             preserveNullAndEmptyArrays: true
        //         }
        //     },

        //     {
        //         $group: {
        //             _id: "$_id",
        //             courseName: { $first: "$courseName" },
        //             version: { $first: "$version" },

        //             quizIds: {
        //                 $addToSet: {
        //                     $cond: [
        //                         { $eq: ["$groups.items.type", "QUIZ"] },
        //                         {
        //                             $cond: [
        //                                 { $eq: [{ $type: "$groups.items._id" }, "string"] },
        //                                 {
        //                                     $convert: {
        //                                         input: "$groups.items._id",
        //                                         to: "objectId",
        //                                         onError: null,
        //                                         onNull: null
        //                                     }
        //                                 },
        //                                 "$groups.items._id"
        //                             ]
        //                         },
        //                         null
        //                     ]
        //                 }
        //             },

        //             courseItems: {
        //                 $addToSet: {
        //                     itemId: {
        //                         $cond: [
        //                             { $eq: [{ $type: "$groups.items._id" }, "string"] },
        //                             {
        //                                 $convert: {
        //                                     input: "$groups.items._id",
        //                                     to: "objectId",
        //                                     onError: null,
        //                                     onNull: null
        //                                 }
        //                             },
        //                             "$groups.items._id"
        //                         ]
        //                     },
        //                     name: { $ifNull: ["$groups.items.name", "Unknown Item"] },
        //                     type: "$groups.items.type"
        //                 }
        //             }
        //         }
        //     },

        //     {
        //         $addFields: {
        //             quizIds: {
        //                 $filter: {
        //                     input: { $ifNull: ["$quizIds", []] },
        //                     as: "q",
        //                     cond: { $ne: ["$$q", null] }
        //                 }
        //             },
        //             courseItems: {
        //                 $filter: {
        //                     input: { $ifNull: ["$courseItems", []] },
        //                     as: "item",
        //                     cond: { $ne: ["$$item.itemId", null] }
        //                 }
        //             }
        //         }
        //     },

        //     {
        //         $lookup: {
        //             from: "enrollment",
        //             let: {
        //                 cid: new ObjectId("6981df886e100cfe04f9c4ad"),
        //                 vid: "$_id",
        //                 qids: "$quizIds",
        //                 courseItems: "$courseItems"
        //             },
        //             pipeline: [
        //                 {
        //                     $match: {
        //                         $expr: {
        //                             $and: [
        //                                 { $eq: ["$courseId", "$$cid"] },
        //                                 { $eq: ["$courseVersionId", "$$vid"] }
        //                             ]
        //                         }
        //                     }
        //                 },

        //                 {
        //                     $lookup: {
        //                         from: "users",
        //                         let: { uid: "$userId" },
        //                         pipeline: [
        //                             { $match: { $expr: { $eq: ["$_id", "$$uid"] } } },
        //                             { $project: { _id: 0, firstName: 1, lastName: 1 } }
        //                         ],
        //                         as: "userDoc"
        //                     }
        //                 },
        //                 {
        //                     $addFields: {
        //                         userName: {
        //                             $trim: {
        //                                 input: {
        //                                     $concat: [
        //                                         { $ifNull: [{ $arrayElemAt: ["$userDoc.firstName", 0] }, ""] },
        //                                         " ",
        //                                         { $ifNull: [{ $arrayElemAt: ["$userDoc.lastName", 0] }, ""] }
        //                                     ]
        //                                 }
        //                             }
        //                         }
        //                     }
        //                 },

        //                 {
        //                     $lookup: {
        //                         from: "quiz_attempts",
        //                         let: { qids: "$$qids", uid: "$userId" },
        //                         pipeline: [
        //                             {
        //                                 $addFields: {
        //                                     quizObjId: {
        //                                         $cond: [
        //                                             { $eq: [{ $type: "$quizId" }, "string"] },
        //                                             {
        //                                                 $convert: {
        //                                                     input: "$quizId",
        //                                                     to: "objectId",
        //                                                     onError: null,
        //                                                     onNull: null
        //                                                 }
        //                                             },
        //                                             "$quizId"
        //                                         ]
        //                                     }
        //                                 }
        //                             },
        //                             {
        //                                 $match: {
        //                                     $expr: {
        //                                         $and: [
        //                                             { $eq: ["$userId", "$$uid"] },
        //                                             { $in: ["$quizObjId", "$$qids"] }
        //                                         ]
        //                                     }
        //                                 }
        //                             },
        //                             { $count: "cnt" }
        //                         ],
        //                         as: "quizAttemptsAgg"
        //                     }
        //                 },

        //                 {
        //                     $lookup: {
        //                         from: "watchTime",
        //                         let: {
        //                             uid: "$userId",
        //                             cid: "$courseId",
        //                             vid: "$courseVersionId"
        //                         },
        //                         pipeline: [
        //                             {
        //                                 $addFields: {
        //                                     itemObjId: {
        //                                         $cond: [
        //                                             { $eq: [{ $type: "$itemId" }, "string"] },
        //                                             {
        //                                                 $convert: {
        //                                                     input: "$itemId",
        //                                                     to: "objectId",
        //                                                     onError: null,
        //                                                     onNull: null
        //                                                 }
        //                                             },
        //                                             "$itemId"
        //                                         ]
        //                                     }
        //                                 }
        //                             },
        //                             {
        //                                 $match: {
        //                                     $expr: {
        //                                         $and: [
        //                                             { $eq: ["$userId", "$$uid"] },
        //                                             { $eq: ["$courseId", "$$cid"] },
        //                                             { $eq: ["$courseVersionId", "$$vid"] },
        //                                             { $ne: ["$endTime", null] },
        //                                             { $ne: ["$isNotPure", true] },
        //                                             { $ne: ["$itemObjId", null] }
        //                                         ]
        //                                     }
        //                                 }
        //                             },
        //                             {
        //                                 $group: {
        //                                     _id: "$itemObjId",
        //                                     totalMs: {
        //                                         $sum: { $subtract: ["$endTime", "$startTime"] }
        //                                     },
        //                                     viewCount: { $sum: 1 }
        //                                 }
        //                             },
        //                             {
        //                                 $project: {
        //                                     _id: 0,
        //                                     itemId: "$_id",
        //                                     watchHours: {
        //                                         $round: [{ $divide: ["$totalMs", 1000 * 60 * 60] }, 2]
        //                                     },
        //                                     viewCount: 1
        //                                 }
        //                             }
        //                         ],
        //                         as: "itemWatchAgg"
        //                     }
        //                 },

        //                 {
        //                     $addFields: {
        //                         itemWiseWatchHours: {
        //                             $map: {
        //                                 input: { $ifNull: ["$$courseItems", []] },
        //                                 as: "courseItem",
        //                                 in: {
        //                                     name: "$$courseItem.name",
        //                                     type: "$$courseItem.type",
        //                                     watchHours: {
        //                                         $let: {
        //                                             vars: {
        //                                                 matchedWatch: {
        //                                                     $arrayElemAt: [
        //                                                         {
        //                                                             $filter: {
        //                                                                 input: "$itemWatchAgg",
        //                                                                 as: "wa",
        //                                                                 cond: {
        //                                                                     $eq: ["$$wa.itemId", "$$courseItem.itemId"]
        //                                                                 }
        //                                                             }
        //                                                         },
        //                                                         0
        //                                                     ]
        //                                                 }
        //                                             },
        //                                             in: { $ifNull: ["$$matchedWatch.watchHours", 0] }
        //                                         }
        //                                     },
        //                                     viewCount: {
        //                                         $let: {
        //                                             vars: {
        //                                                 matchedWatch: {
        //                                                     $arrayElemAt: [
        //                                                         {
        //                                                             $filter: {
        //                                                                 input: "$itemWatchAgg",
        //                                                                 as: "wa",
        //                                                                 cond: {
        //                                                                     $eq: ["$$wa.itemId", "$$courseItem.itemId"]
        //                                                                 }
        //                                                             }
        //                                                         },
        //                                                         0
        //                                                     ]
        //                                                 }
        //                                             },
        //                                             in: { $ifNull: ["$$matchedWatch.viewCount", 0] }
        //                                         }
        //                                     }
        //                                 }
        //                             }
        //                         }
        //                     }
        //                 },

        //                 {
        //                     $project: {
        //                         _id: 0,
        //                         userId: { $toString: "$userId" },
        //                         userName: 1,
        //                         enrolledAt: {
        //                             $dateToString: {
        //                                 date: "$enrollmentDate",
        //                                 format: "%d-%m-%Y %H:%M",
        //                                 timezone: "Asia/Kolkata"
        //                             }
        //                         },
        //                         percentCompleted: 1,
        //                         completedItemsCount: 1,
        //                         status: 1,
        //                         isDeleted: 1,
        //                         isInactiveUser: {
        //                             $cond: [
        //                                 {
        //                                     $or: [
        //                                         { $eq: ["$isDeleted", true] },
        //                                         { $eq: ["$status", "INACTIVE"] }
        //                                     ]
        //                                 },
        //                                 true,
        //                                 false
        //                             ]
        //                         },
        //                         totalQuizAttempts: {
        //                             $ifNull: [{ $arrayElemAt: ["$quizAttemptsAgg.cnt", 0] }, 0]
        //                         },
        //                         totalWatchHours: {
        //                             $round: [
        //                                 {
        //                                     $sum: {
        //                                         $map: {
        //                                             input: { $ifNull: ["$itemWiseWatchHours", []] },
        //                                             as: "item",
        //                                             in: { $ifNull: ["$$item.watchHours", 0] }
        //                                         }
        //                                     }
        //                                 },
        //                                 2
        //                             ]
        //                         },
        //                         itemWiseWatchHours: 1
        //                     }
        //                 }
        //             ],
        //             as: "enrollments"
        //         }
        //     },

        //     {
        //         $addFields: {
        //             totalEnrollments: { $size: { $ifNull: ["$enrollments", []] } },
        //             totalWatchTimeHours: {
        //                 $round: [
        //                     {
        //                         $sum: {
        //                             $map: {
        //                                 input: { $ifNull: ["$enrollments", []] },
        //                                 as: "e",
        //                                 in: { $ifNull: ["$$e.totalWatchHours", 0] }
        //                             }
        //                         }
        //                     },
        //                     2
        //                 ]
        //             }
        //         }
        //     },

        //     {
        //         $unwind: {
        //             path: "$enrollments",
        //             preserveNullAndEmptyArrays: true
        //         }
        //     },

        //     {
        //         $project: {
        //             _id: 0,
        //             userId: "$enrollments.userId",
        //             userName: "$enrollments.userName",
        //             enrolledAt: "$enrollments.enrolledAt",
        //             percentCompleted: "$enrollments.percentCompleted",
        //             completedItemsCount: "$enrollments.completedItemsCount",
        //             status: "$enrollments.status",
        //             isDeleted: "$enrollments.isDeleted",
        //             isInactiveUser: "$enrollments.isInactiveUser",
        //             totalQuizAttempts: "$enrollments.totalQuizAttempts",
        //             totalWatchHours: "$enrollments.totalWatchHours",
        //             itemWiseWatchHours: "$enrollments.itemWiseWatchHours"
        //         }
        //     }
        // ]).toArray();





        ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



        // const courseId = new ObjectId("6981df886e100cfe04f9c4ad");
        // const versionId = new ObjectId("6981df886e100cfe04f9c4ae");
        /*
        STEP 1: Fetch FEEDBACK items and forms
        */

        // const meta = await this.courseVersionCollection.aggregate([
        //     { $match: { _id: versionId } },

        //     { $unwind: "$modules" },
        //     { $unwind: "$modules.sections" },

        //     {
        //         $project: {
        //             itemsGroupId: {
        //                 $cond: [
        //                     { $eq: [{ $type: "$modules.sections.itemsGroupId" }, "string"] },
        //                     {
        //                         $convert: {
        //                             input: "$modules.sections.itemsGroupId",
        //                             to: "objectId",
        //                             onError: null,
        //                             onNull: null
        //                         }
        //                     },
        //                     "$modules.sections.itemsGroupId"
        //                 ]
        //             }
        //         }
        //     },

        //     {
        //         $group: {
        //             _id: null,
        //             groupIds: { $addToSet: "$itemsGroupId" }
        //         }
        //     },

        //     {
        //         $lookup: {
        //             from: "itemsGroup",
        //             localField: "groupIds",
        //             foreignField: "_id",
        //             as: "groups"
        //         }
        //     },

        //     { $unwind: "$groups" },
        //     { $unwind: "$groups.items" },

        //     { $match: { "groups.items.type": "FEEDBACK" } },

        //     {
        //         $addFields: {
        //             feedbackId: {
        //                 $cond: [
        //                     { $eq: [{ $type: "$groups.items._id" }, "string"] },
        //                     { $toObjectId: "$groups.items._id" },
        //                     "$groups.items._id"
        //                 ]
        //             }
        //         }
        //     },

        //     {
        //         $lookup: {
        //             from: "feedback_forms",
        //             localField: "feedbackId",
        //             foreignField: "_id",
        //             as: "form"
        //         }
        //     },

        //     { $unwind: "$form" },

        //     {
        //         $group: {
        //             _id: null,
        //             feedbackFormIds: { $addToSet: "$form._id" },
        //             feedbackForms: {
        //                 $addToSet: {
        //                     feedbackFormId: "$form._id",
        //                     name: "$form.name"
        //                 }
        //             }
        //         }
        //     },

        //     {
        //         $project: {
        //             _id: 0,
        //             feedbackFormIds: 1,
        //             feedbackForms: 1,
        //             totalFeedbackForms: { $size: "$feedbackFormIds" }
        //         }
        //     }

        // ]).toArray();

        // const metaData = meta[0] || {
        //     feedbackFormIds: [],
        //     feedbackForms: [],
        //     totalFeedbackForms: 0
        // };

        /*
        STEP 2: Fetch students + feedback submission stats
        */

        // const students = await this.enrollmentCollection.aggregate([
        //     {
        //         $match: {
        //             courseId: courseId,
        //             courseVersionId: versionId
        //         }
        //     },

        //     {
        //         $lookup: {
        //             from: "users",
        //             localField: "userId",
        //             foreignField: "_id",
        //             as: "user"
        //         }
        //     },

        //     { $unwind: "$user" },

        //     {
        //         $addFields: {
        //             userName: {
        //                 $concat: [
        //                     { $ifNull: ["$user.firstName", ""] },
        //                     " ",
        //                     { $ifNull: ["$user.lastName", ""] }
        //                 ]
        //             },
        //             isInactiveUser: {
        //                 $cond: [
        //                     {
        //                         $or: [
        //                             { $eq: ["$isDeleted", true] },
        //                             { $eq: ["$status", "INACTIVE"] }
        //                         ]
        //                     },
        //                     true,
        //                     false
        //                 ]
        //             }
        //         }
        //     },

        //     {
        //         $lookup: {
        //             from: "feedback_submission",
        //             let: {
        //                 uid: "$userId",
        //                 formIds: metaData.feedbackFormIds
        //             },
        //             pipeline: [
        //                 {
        //                     $match: {
        //                         $expr: {
        //                             $and: [
        //                                 { $eq: ["$userId", "$$uid"] },
        //                                 { $in: ["$feedbackFormId", "$$formIds"] }
        //                             ]
        //                         }
        //                     }
        //                 },
        //                 {
        //                     $group: {
        //                         _id: null,
        //                         totalSubmitted: { $sum: 1 },
        //                         uniqueForms: { $addToSet: "$feedbackFormId" }
        //                     }
        //                 },
        //                 {
        //                     $project: {
        //                         totalSubmitted: 1,
        //                         uniqueSubmitted: { $size: "$uniqueForms" }
        //                     }
        //                 }
        //             ],
        //             as: "feedbackAgg"
        //         }
        //     },

        //     {
        //         $addFields: {
        //             totalFeedbackForms: metaData.totalFeedbackForms,
        //             totalFeedbackSubmitted: {
        //                 $ifNull: [{ $arrayElemAt: ["$feedbackAgg.totalSubmitted", 0] }, 0]
        //             },
        //             uniqueFeedbackSubmitted: {
        //                 $ifNull: [{ $arrayElemAt: ["$feedbackAgg.uniqueSubmitted", 0] }, 0]
        //             }
        //         }
        //     },

        //     {
        //         $addFields: {
        //             submittedAllFeedback: {
        //                 $eq: ["$uniqueFeedbackSubmitted", "$totalFeedbackForms"]
        //             },
        //             completionPercentage: {
        //                 $cond: [
        //                     { $gt: ["$totalFeedbackForms", 0] },
        //                     {
        //                         $multiply: [
        //                             { $divide: ["$uniqueFeedbackSubmitted", "$totalFeedbackForms"] },
        //                             100
        //                         ]
        //                     },
        //                     0
        //                 ]
        //             }
        //         }
        //     },

        //     {
        //         $project: {
        //             _id: 0,
        //             userId: { $toString: "$userId" },
        //             email: "$user.email",
        //             userName: 1,
        //             status: 1,
        //             isDeleted: 1,
        //             isInactiveUser: 1,
        //             totalFeedbackForms: 1,
        //             totalFeedbackSubmitted: 1,
        //             uniqueFeedbackSubmitted: 1,
        //             submittedAllFeedback: 1,
        //             completionPercentage: { $round: ["$completionPercentage", 2] }
        //         }
        //     }

        // ], { allowDiskUse: true }).toArray();


        /*
        FINAL RESULT
        */
        // return {
        //     courseId: courseId.toString(),
        //     courseVersionId: versionId.toString(),
        //     totalFeedbackForms: metaData.totalFeedbackForms,
        //     feedbackForms: metaData.feedbackForms.map((f) => ({
        //         feedbackFormId: f.feedbackFormId?.toString(),
        //         name: f.name
        //     })),
        //     totalStudents: students.length,
        //     students
        // };




        ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////// 
        // TO GET FEEDBACK SUBMISSION DETAILS OF ENRLLED STUDENTS IN A COURSE


        /*
        const courseId = new ObjectId("6981df886e100cfe04f9c4ad");
        const versionId = new ObjectId("6981df886e100cfe04f9c4ae");

        const result = await this.enrollmentCollection.aggregate([
            {
                $match: {
                    courseId,
                    courseVersionId: versionId,
                    role: "STUDENT",
                    isDeleted: { $ne: true }
                }
            },

            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "user"
                }
            },
            {
                $unwind: {
                    path: "$user",
                    preserveNullAndEmptyArrays: true
                }
            },

            {
                $lookup: {
                    from: "feedback_submission",
                    let: {
                        uid: "$userId",
                        cid: "$courseId",
                        vid: "$courseVersionId"
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$userId", "$$uid"] },
                                        { $eq: ["$courseId", "$$cid"] },
                                        { $eq: ["$courseVersionId", "$$vid"] }
                                    ]
                                }
                            }
                        },

                        // latest record first
                        { $sort: { updatedAt: -1, createdAt: -1, _id: -1 } },

                        // keep only one unique submission
                        {
                            $group: {
                                _id: {
                                    userId: "$userId",
                                    feedbackFormId: "$feedbackFormId",
                                    previousItemId: "$previousItemId"
                                },
                                doc: { $first: "$$ROOT" }
                            }
                        },
                        { $replaceRoot: { newRoot: "$doc" } },

                        {
                            $lookup: {
                                from: "feedback_forms",
                                localField: "feedbackFormId",
                                foreignField: "_id",
                                as: "feedbackForm"
                            }
                        },
                        {
                            $unwind: {
                                path: "$feedbackForm",
                                preserveNullAndEmptyArrays: true
                            }
                        },

                        // BLOG lookup
                        {
                            $lookup: {
                                from: "blogs",
                                let: {
                                    prevId: "$previousItemId",
                                    prevType: "$previousItemType"
                                },
                                pipeline: [
                                    {
                                        $match: {
                                            $expr: {
                                                $and: [
                                                    { $eq: ["$$prevType", "BLOG"] },
                                                    { $eq: ["$_id", "$$prevId"] }
                                                ]
                                            }
                                        }
                                    },
                                    {
                                        $project: {
                                            _id: 1,
                                            name: { $ifNull: ["$name", "$title"] }
                                        }
                                    }
                                ],
                                as: "blogItem"
                            }
                        },

                        // VIDEO lookup
                        {
                            $lookup: {
                                from: "videos",
                                let: {
                                    prevId: "$previousItemId",
                                    prevType: "$previousItemType"
                                },
                                pipeline: [
                                    {
                                        $match: {
                                            $expr: {
                                                $and: [
                                                    { $eq: ["$$prevType", "VIDEO"] },
                                                    { $eq: ["$_id", "$$prevId"] }
                                                ]
                                            }
                                        }
                                    },
                                    {
                                        $project: {
                                            _id: 1,
                                            name: { $ifNull: ["$name", "$title"] }
                                        }
                                    }
                                ],
                                as: "videoItem"
                            }
                        },

                        // QUIZ lookup
                        {
                            $lookup: {
                                from: "quizzes",
                                let: {
                                    prevId: "$previousItemId",
                                    prevType: "$previousItemType"
                                },
                                pipeline: [
                                    {
                                        $match: {
                                            $expr: {
                                                $and: [
                                                    { $eq: ["$$prevType", "QUIZ"] },
                                                    { $eq: ["$_id", "$$prevId"] }
                                                ]
                                            }
                                        }
                                    },
                                    {
                                        $project: {
                                            _id: 1,
                                            name: { $ifNull: ["$name", "$title"] }
                                        }
                                    }
                                ],
                                as: "quizItem"
                            }
                        },

                        {
                            $addFields: {
                                previousItemName: {
                                    $ifNull: [
                                        { $arrayElemAt: ["$blogItem.name", 0] },
                                        {
                                            $ifNull: [
                                                { $arrayElemAt: ["$videoItem.name", 0] },
                                                { $arrayElemAt: ["$quizItem.name", 0] }
                                            ]
                                        }
                                    ]
                                }
                            }
                        },

                        {
                            $project: {
                                _id: 0,
                                feedbackSubmissionId: { $toString: "$_id" },
                                feedbackFormId: { $toString: "$feedbackFormId" },
                                feedbackName: "$feedbackForm.name",
                                previousItemId: {
                                    $cond: [
                                        { $ifNull: ["$previousItemId", false] },
                                        { $toString: "$previousItemId" },
                                        null
                                    ]
                                },
                                previousItemType: 1,
                                previousItemName: 1,
                                details: 1,
                                createdAt: 1,
                                updatedAt: 1
                            }
                        },

                        { $sort: { updatedAt: -1, createdAt: -1 } }
                    ],
                    as: "feedbackSubmissions"
                }
            },

            // one row per feedback submission
            {
                $unwind: {
                    path: "$feedbackSubmissions",
                    preserveNullAndEmptyArrays: true
                }
            },

            {
                $project: {
                    _id: 0,
                    enrollmentId: { $toString: "$_id" },
                    userId: { $toString: "$userId" },
                    userEmail: "$user.email",
                    userName: {
                        $trim: {
                            input: {
                                $concat: [
                                    { $ifNull: ["$user.firstName", ""] },
                                    " ",
                                    { $ifNull: ["$user.lastName", ""] }
                                ]
                            }
                        }
                    },
                    role: 1,
                    status: 1,

                    feedbackSubmissionId: "$feedbackSubmissions.feedbackSubmissionId",
                    feedbackFormId: "$feedbackSubmissions.feedbackFormId",
                    feedbackName: "$feedbackSubmissions.feedbackName",
                    previousItemId: "$feedbackSubmissions.previousItemId",
                    previousItemType: "$feedbackSubmissions.previousItemType",
                    previousItemName: "$feedbackSubmissions.previousItemName",
                    details: "$feedbackSubmissions.details",
                    createdAt: "$feedbackSubmissions.createdAt",
                    updatedAt: "$feedbackSubmissions.updatedAt"
                }
            },

            {
                $sort: {
                    userEmail: 1,
                    updatedAt: -1
                }
            }
        ], { allowDiskUse: true }).toArray();

        return result;
        */


        // NEW QUERY: GuruSetu pilot feedback rows for students with >50% watch-time per video.
        const guruSetuCourseId = new ObjectId("6981df886e100cfe04f9c4ad");
        const guruSetuVersionId = new ObjectId("6981df886e100cfe04f9c4ae");
        const watchTimeCollection = await this.db.getCollection<any>("watchTime");

        const result = await watchTimeCollection.aggregate([
            {
                $match: {
                    courseId: guruSetuCourseId,
                    courseVersionId: guruSetuVersionId,
                    endTime: { $ne: null },
                    isNotPure: { $ne: true },
                },
            },
            {
                $addFields: {
                    itemObjId: {
                        $cond: [
                            { $eq: [{ $type: "$itemId" }, "string"] },
                            {
                                $convert: {
                                    input: "$itemId",
                                    to: "objectId",
                                    onError: null,
                                    onNull: null,
                                },
                            },
                            "$itemId",
                        ],
                    },
                },
            },
            {
                $match: {
                    itemObjId: { $ne: null },
                },
            },
            {
                $group: {
                    _id: {
                        userId: "$userId",
                        videoId: "$itemObjId",
                    },
                    rawWatchedMs: { $sum: { $subtract: ["$endTime", "$startTime"] } },
                    watchSessionCount: { $sum: 1 },
                    firstWatchAt: { $min: "$startTime" },
                    lastWatchAt: { $max: "$startTime" },
                },
            },
            {
                $addFields: {
                    userId: "$_id.userId",
                    videoId: "$_id.videoId",
                    rawWatchedSeconds: {
                        $round: [{ $divide: ["$rawWatchedMs", 1000] }, 2],
                    },
                },
            },
            {
                $lookup: {
                    from: "videos",
                    localField: "videoId",
                    foreignField: "_id",
                    as: "video",
                },
            },
            {
                $unwind: {
                    path: "$video",
                    preserveNullAndEmptyArrays: false,
                },
            },
            {
                $addFields: {
                    videoName: { $ifNull: ["$video.name", "$video.title"] },
                    videoDurationSeconds: {
                        $let: {
                            vars: {
                                startParts: {
                                    $split: [{ $ifNull: ["$video.details.startTime", "00:00:00"] }, ":"],
                                },
                                endParts: {
                                    $split: [{ $ifNull: ["$video.details.endTime", "00:00:00"] }, ":"],
                                },
                            },
                            in: {
                                $max: [
                                    0,
                                    {
                                        $subtract: [
                                            {
                                                $add: [
                                                    {
                                                        $multiply: [
                                                            {
                                                                $convert: {
                                                                    input: { $arrayElemAt: ["$$endParts", 0] },
                                                                    to: "int",
                                                                    onError: 0,
                                                                    onNull: 0,
                                                                },
                                                            },
                                                            3600,
                                                        ],
                                                    },
                                                    {
                                                        $multiply: [
                                                            {
                                                                $convert: {
                                                                    input: { $arrayElemAt: ["$$endParts", 1] },
                                                                    to: "int",
                                                                    onError: 0,
                                                                    onNull: 0,
                                                                },
                                                            },
                                                            60,
                                                        ],
                                                    },
                                                    {
                                                        $convert: {
                                                            input: { $arrayElemAt: ["$$endParts", 2] },
                                                            to: "int",
                                                            onError: 0,
                                                            onNull: 0,
                                                        },
                                                    },
                                                ],
                                            },
                                            {
                                                $add: [
                                                    {
                                                        $multiply: [
                                                            {
                                                                $convert: {
                                                                    input: { $arrayElemAt: ["$$startParts", 0] },
                                                                    to: "int",
                                                                    onError: 0,
                                                                    onNull: 0,
                                                                },
                                                            },
                                                            3600,
                                                        ],
                                                    },
                                                    {
                                                        $multiply: [
                                                            {
                                                                $convert: {
                                                                    input: { $arrayElemAt: ["$$startParts", 1] },
                                                                    to: "int",
                                                                    onError: 0,
                                                                    onNull: 0,
                                                                },
                                                            },
                                                            60,
                                                        ],
                                                    },
                                                    {
                                                        $convert: {
                                                            input: { $arrayElemAt: ["$$startParts", 2] },
                                                            to: "int",
                                                            onError: 0,
                                                            onNull: 0,
                                                        },
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        },
                    },
                },
            },
            {
                $addFields: {
                    rawWatchedSecondsUncapped: "$rawWatchedSeconds",
                    rawWatchedSeconds: {
                        $min: ["$rawWatchedSeconds", "$videoDurationSeconds"],
                    },
                },
            },
            {
                $match: {
                    $expr: {
                        $and: [
                            { $gt: ["$videoDurationSeconds", 0] },
                            {
                                $gt: [
                                    "$rawWatchedSeconds",
                                    { $multiply: ["$videoDurationSeconds", 0.5] },
                                ],
                            },
                        ],
                    },
                },
            },
            {
                $lookup: {
                    from: "users",
                    localField: "userId",
                    foreignField: "_id",
                    as: "user",
                },
            },
            {
                $unwind: {
                    path: "$user",
                    preserveNullAndEmptyArrays: false,
                },
            },
            {
                $lookup: {
                    from: "enrollment",
                    let: { uid: "$userId" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$userId", "$$uid"] },
                                        { $eq: ["$courseId", guruSetuCourseId] },
                                        { $eq: ["$courseVersionId", guruSetuVersionId] },
                                        { $eq: ["$role", "STUDENT"] },
                                        { $ne: ["$isDeleted", true] },
                                    ],
                                },
                            },
                        },
                        { $limit: 1 },
                    ],
                    as: "enrollment",
                },
            },
            {
                $match: {
                    "enrollment.0": { $exists: true },
                },
            },
            {
                $lookup: {
                    from: "feedback_submission",
                    let: {
                        uid: "$userId",
                        vid: "$videoId",
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$userId", "$$uid"] },
                                        { $eq: ["$courseId", guruSetuCourseId] },
                                        { $eq: ["$courseVersionId", guruSetuVersionId] },
                                        { $eq: ["$previousItemId", "$$vid"] },
                                        { $eq: ["$previousItemType", "VIDEO"] },
                                    ],
                                },
                            },
                        },
                        { $sort: { updatedAt: -1, createdAt: -1, _id: -1 } },
                        {
                            $group: {
                                _id: {
                                    userId: "$userId",
                                    feedbackFormId: "$feedbackFormId",
                                    previousItemId: "$previousItemId",
                                },
                                doc: { $first: "$$ROOT" },
                            },
                        },
                        { $replaceRoot: { newRoot: "$doc" } },
                    ],
                    as: "feedbackSubmission",
                },
            },
            {
                $unwind: {
                    path: "$feedbackSubmission",
                    preserveNullAndEmptyArrays: false,
                },
            },
            {
                $lookup: {
                    from: "feedback_forms",
                    localField: "feedbackSubmission.feedbackFormId",
                    foreignField: "_id",
                    as: "feedbackForm",
                },
            },
            {
                $unwind: {
                    path: "$feedbackForm",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $project: {
                    _id: 0,
                    userId: { $toString: "$userId" },
                    userEmail: "$user.email",
                    videoName: 1,
                    videoDurationSeconds: 1,
                    rawWatchedSeconds: 1,
                    rawWatchedSecondsUncapped: 1,
                    watchSessionCount: 1,
                    firstWatchAt: 1,
                    lastWatchAt: 1,
                    details: "$feedbackSubmission.details",
                    feedbackFormName: "$feedbackForm.name",
                    "Was the explanation in the video clear?": {
                        $getField: {
                            field: "Was the explanation in the video clear?",
                            input: "$feedbackSubmission.details",
                        },
                    },
                    "How would you rate the Audio & Visual quality?": {
                        $getField: {
                            field: "How would you rate the Audio & Visual quality?",
                            input: "$feedbackSubmission.details",
                        },
                    },
                    "How was the pacing of the content in the video?": {
                        $getField: {
                            field: "How was the pacing of the content in the video?",
                            input: "$feedbackSubmission.details",
                        },
                    },
                    "Did the video hold your attention?": {
                        $getField: {
                            field: "Did the video hold your attention?",
                            input: "$feedbackSubmission.details",
                        },
                    },
                    "How useful do you find this content ?": {
                        $getField: {
                            field: "How useful do you find this content ?",
                            input: "$feedbackSubmission.details",
                        },
                    },
                    "How confident do you feel applying this concept in your daily/ professional life?": {
                        $getField: {
                            field: "How confident do you feel applying this concept in your daily/ professional life?",
                            input: "$feedbackSubmission.details",
                        },
                    },
                    "Please share your feedback here": {
                        $getField: {
                            field: "Please share your feedback here",
                            input: "$feedbackSubmission.details",
                        },
                    },
                    createdAt: "$feedbackSubmission.createdAt",
                },
            },
            {
                $sort: {
                    userEmail: 1,
                    videoName: 1,
                    createdAt: -1,
                },
            },
        ], { allowDiskUse: true }).toArray();

        return result;
    }

}