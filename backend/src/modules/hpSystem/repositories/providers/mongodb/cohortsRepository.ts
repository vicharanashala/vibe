import { Course, CourseVersion } from "#root/modules/courses/classes/index.js";
import { CohortStudentItemDto, CohortStudentsListQueryDto } from "#root/modules/hpSystem/classes/validators/courseAndCohorts.js";
import { ID } from "#root/modules/hpSystem/constants.js";
import { ICohortRepository } from "#root/modules/hpSystem/interfaces/ICohortsRepository.js";
import { ICohort, IEnrollment, MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { plainToInstance } from "class-transformer";
import { CourseWithVersionsDto } from "#root/modules/hpSystem/classes/validators/courseAndCohorts.js";
import { inject, injectable } from "inversify";
import { ClientSession, Collection, ObjectId } from "mongodb";
import { HpActivity, HpLedger } from "#root/modules/hpSystem/models.js";
import { HpActivitySubmission } from "#root/modules/hpSystem/classes/transformers/ActivitySubmission.js";

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

    async getTotalStudentsCountForCourseVersion(courseVersionId: string): Promise<number> {
        await this.init();
        return await this.enrollmentCollection.countDocuments({
            courseVersionId: new ObjectId(courseVersionId), isDeleted: { $ne: true },
        });
    }

    async getCohortsByVersionId(courseVersionId: string): Promise<ICohort[]> {
        await this.init();

        const orVersionMatch: any[] = [{ courseVersionId }];
        if (ObjectId.isValid(courseVersionId)) {
            orVersionMatch.push({ courseVersionId: new ObjectId(courseVersionId) });
        }

        return await this.cohortsCollection
            .find({ $or: orVersionMatch })
            .sort({ createdAt: 1 })
            .toArray();
    }

    async getCohortIdByCohortName(cohortName: string): Promise<string | null> {
        await this.init();

        const cohort = await this.cohortsCollection.findOne(
            { cohortName },
            { projection: { _id: 1 } }
        );

        return cohort?._id?.toString() ?? null;
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
        cohortName: string
    ): Promise<CohortStudentItemDto[]> {
        await this.init();

        const orVersionMatch: any[] = [{ courseVersionId }];
        if (ObjectId.isValid(courseVersionId)) {
            orVersionMatch.push({ courseVersionId: new ObjectId(courseVersionId) });
        }

        const cohortMatch: any = {
            $or: [
                { tag: cohortName },
            ],
        };

        const pipeline: any[] = [
            {
                $match: {
                    $and: [
                        { $or: orVersionMatch },
                        cohortMatch,
                        // optional: if you only want active enrollments
                        // { status: "active" },
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
                    totalHp: { $literal: 0 },
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


    private async _getCohortMatchConditions(cohort: string, versionId: string): Promise<any[]> {
        const orConditions: any[] = [{ tag: cohort }];

        if (ObjectId.isValid(cohort)) {
            orConditions.push({ cohortId: new ObjectId(cohort) });
            orConditions.push({ cohortId: cohort });
        } else {
            const dynamicCohort = await this.cohortsCollection.findOne({ name: cohort, courseVersionId: new ObjectId(versionId) });
            if (dynamicCohort) {
                orConditions.push({ cohortId: dynamicCohort._id });
                orConditions.push({ cohortId: dynamicCohort._id.toString() });
            }
        }

        return orConditions;
    }

    async findEnrollment(
        userId: string | ObjectId,
        courseId: string,
        courseVersionId: string,
        cohort: string,
        session?: ClientSession,
    ): Promise<IEnrollment | null> {
        await this.init();

        const cohortConditions = await this._getCohortMatchConditions(cohort, courseVersionId);

        return await this.enrollmentCollection.findOne(
            {
                userId: { $in: [userId, new ObjectId(userId)] },
                courseId: { $in: [courseId, new ObjectId(courseId)] },
                courseVersionId: { $in: [courseVersionId, new ObjectId(courseVersionId)] },
                $or: cohortConditions,
                isDeleted: { $ne: true },

            },
            { session }
        );
    }

    /**
     * Checks if a user has an active STUDENT enrollment for a given courseVersionId.
     */
    async isStudentEnrolledInVersion(userId: string, courseVersionId: string): Promise<boolean> {
        await this.init();
        const userObjId = new ObjectId(userId);
        const versionObjId = ObjectId.isValid(courseVersionId) ? new ObjectId(courseVersionId) : null;

        const match: any = {
            userId: { $in: [userId, userObjId] },
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
                },
            },
        ];

        return (await this.enrollmentCollection.aggregate(pipeline).toArray()) as any;
    }

    async setHPForEnrollment(
        userId: ID,
        courseId: ID,
        courseVersionId: ID,
        cohort: string,
        amount: number,
        session?: ClientSession,
    ): Promise<boolean> {
        await this.init();

        const cohortConditions = await this._getCohortMatchConditions(cohort, courseVersionId.toString());

        const updateResult = await this.enrollmentCollection.updateOne(
            {
                userId: { $in: [userId, new ObjectId(userId)] },
                courseId: { $in: [courseId, new ObjectId(courseId)] },
                courseVersionId: { $in: [courseVersionId, new ObjectId(courseVersionId)] },
                isDeleted: { $ne: true },
                $or: [
                    { cohortId: { $exists: false } },
                    {
                        cohortId: { $exists: true },
                        $or: cohortConditions,
                    },
                ],
            },
            {
                $set: {
                    hpPoints: amount,
                    updatedAt: new Date(),
                },
            },
            { session }
        );


        return updateResult.modifiedCount > 0;
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

        const match: any = {
            courseVersionId: new ObjectId(courseVersionId),
        };

        if (cohortId) {
            match.cohortId = new ObjectId(cohortId);
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

        const filter = {
            cohort: oldCohortName,
            courseVersionId: new ObjectId(courseVersionId),
        };

        const update = {
            $set: { cohort: newCohortName },
        };

        await Promise.all([
            this.hpActivityCollection.updateMany(filter, update),
            this.hpActivitySubmissionCollection.updateMany(filter, update),
            this.hpLedgerCollection.updateMany(filter, update),
        ]);
    }
}