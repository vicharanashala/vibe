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
    }

}