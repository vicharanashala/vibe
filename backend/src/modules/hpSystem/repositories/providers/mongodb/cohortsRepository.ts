import { Course, CourseVersion } from "#root/modules/courses/classes/index.js";
import { CohortStudentItemDto, CohortStudentsListQueryDto } from "#root/modules/hpSystem/classes/validators/courseAndCohorts.js";
import { ID } from "#root/modules/hpSystem/constants.js";
import { ICohortRepository } from "#root/modules/hpSystem/interfaces/ICohortsRepository.js";
import { IEnrollment, MongoDatabase } from "#root/shared/index.js";
import { GLOBAL_TYPES } from "#root/types.js";
import { plainToInstance } from "class-transformer";
import { inject, injectable } from "inversify";
import { ClientSession, Collection, ObjectId } from "mongodb";

@injectable()
export class CohortRepository implements ICohortRepository {
    private courseCollection: Collection<Course>;
    private courseVersionCollection: Collection<CourseVersion>;
    private enrollmentCollection: Collection<IEnrollment>;

    constructor(
        @inject(GLOBAL_TYPES.Database)
        private db: MongoDatabase,
    ) { }

    private async init() {
        this.courseCollection = await this.db.getCollection<Course>('newCourse');
        this.courseVersionCollection = await this.db.getCollection<CourseVersion>(
            'newCourseVersion',
        );

        this.enrollmentCollection = await this.db.getCollection<IEnrollment>(
            'enrollment',
        );
    }

    async getTotalStudentsCountForCourseVersion(courseVersionId: string): Promise<number> {
        await this.init();
        return await this.enrollmentCollection.countDocuments({
            courseVersionId: new ObjectId(courseVersionId), isDeleted: { $ne: true },
        });
    }

    async getStudentsForExistingCohortByVersionId(
        courseVersionId: string,
        query: CohortStudentsListQueryDto
    ): Promise<CohortStudentItemDto[]> {
        await this.init();

        // 6968e12cbf2860d6e39051af
        console.log("CourseVersionId in Repo:", courseVersionId);

        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;

        const search = query.search?.trim();
        const sortOrder = query.sortOrder === "desc" ? -1 : 1;

        console.log("Query Params in Repo:", { page, limit, sortBy: query.sortBy, sortOrder: query.sortOrder, search });

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
                    totalHp: { $literal: 0 },
                },
            },

            { $sort: sortStage },
            { $skip: skip },
            { $limit: limit },
        ];

        const docs = await this.enrollmentCollection.aggregate(pipeline).toArray();

        console.log("Aggregated Cohort Students:", docs.length);
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


    async findEnrollment(
        userId: string | ObjectId,
        courseId: string,
        courseVersionId: string,
        session?: ClientSession,
    ): Promise<IEnrollment | null> {
        await this.init();

        return await this.enrollmentCollection.findOne(
            {
                userId: { $in: [userId, new ObjectId(userId)] },
                courseId: { $in: [courseId, new ObjectId(courseId)] },
                courseVersionId: { $in: [courseVersionId, new ObjectId(courseVersionId)] },
                isDeleted: { $ne: true },
            },
            { session }
        );
    }

    async setHPForEnrollment(
        userId: ID,
        courseId: ID,
        courseVersionId: ID,
        amount: number,
        session?: ClientSession,
    ): Promise<boolean> {
        await this.init();

        const updateResult = await this.enrollmentCollection.updateOne(
            {
                userId: { $in: [userId, new ObjectId(userId)] },
                courseId: { $in: [courseId, new ObjectId(courseId)] },
                courseVersionId: { $in: [courseVersionId, new ObjectId(courseVersionId)] },
                isDeleted: { $ne: true },
            },
            {
                $set: {
                    hpPoints: amount,
                    updatedAt: new Date()
                }
            },
            { session }
        );

        return updateResult.modifiedCount > 0;
    }


}