import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import { ClientSession, Collection, MongoClient, ObjectId } from 'mongodb';
import { MongoDatabase } from '../MongoDatabase.js';
import { InternalServerError } from 'routing-controllers';
import { GLOBAL_TYPES } from '#root/types.js';
import { IAnnouncement, AnnouncementType } from '#root/shared/interfaces/models.js';

@injectable()
export class AnnouncementRepository {
    private announcementCollection: Collection<IAnnouncement>;

    constructor(@inject(GLOBAL_TYPES.Database) private db: MongoDatabase) { }

    private async init() {
        this.announcementCollection = await this.db.getCollection<IAnnouncement>('announcements');

        this.announcementCollection.createIndex({ type: 1, createdAt: -1 });
        this.announcementCollection.createIndex({ courseId: 1, createdAt: -1 });
        this.announcementCollection.createIndex({ courseId: 1, courseVersionId: 1, createdAt: -1 });
        this.announcementCollection.createIndex({ instructorId: 1, createdAt: -1 });
    }

    async getDBClient(): Promise<MongoClient> {
        const client = await this.db.getClient();
        if (!client) {
            throw new Error('MongoDB client is not initialized');
        }
        return client;
    }

    async create(
        announcement: IAnnouncement,
        session?: ClientSession,
    ): Promise<string> {
        await this.init();
        try {
            const result = await this.announcementCollection.insertOne(announcement, { session });
            return result.insertedId.toString();
        } catch {
            throw new InternalServerError('Failed to create announcement');
        }
    }

    async findById(
        id: string,
        session?: ClientSession,
    ): Promise<IAnnouncement | null> {
        await this.init();

        const pipeline = [
            { $match: { _id: new ObjectId(id), isDeleted: { $ne: true } } },
            // Lookup Course
            {
                $lookup: {
                    from: 'newCourse',
                    localField: 'courseId',
                    foreignField: '_id',
                    as: 'courseDetails'
                }
            },
            // Lookup Course Version
            {
                $lookup: {
                    from: 'newCourseVersion',
                    localField: 'courseVersionId',
                    foreignField: '_id',
                    as: 'versionDetails'
                }
            },
            // Lookup Instructor for firebaseUID
            {
                $lookup: {
                    from: 'users',
                    localField: 'instructorId',
                    foreignField: '_id',
                    as: 'instructorDetails'
                }
            },
            // Add Fields
            {
                $addFields: {
                    courseName: { $arrayElemAt: ['$courseDetails.name', 0] },
                    courseVersionName: { $arrayElemAt: ['$versionDetails.version', 0] },
                    instructorFirebaseUid: { $arrayElemAt: ['$instructorDetails.firebaseUID', 0] }
                }
            },
            // Remove joined arrays
            {
                $project: {
                    courseDetails: 0,
                    versionDetails: 0,
                    instructorDetails: 0
                }
            }
        ];

        const results = await this.announcementCollection.aggregate(pipeline, { session }).toArray();
        if (results.length === 0) return null;

        const announcement = results[0];

        return {
            ...announcement,
            _id: announcement._id?.toString(),
            courseId: announcement.courseId?.toString(),
            courseVersionId: announcement.courseVersionId?.toString(),
            instructorId: announcement.instructorId?.toString(),
        } as IAnnouncement;
    }

    async update(
        id: string,
        data: Partial<IAnnouncement>,
        session?: ClientSession,
    ): Promise<void> {
        await this.init();
        const result = await this.announcementCollection.updateOne(
            { _id: new ObjectId(id), isDeleted: { $ne: true } },
            { $set: { ...data, updatedAt: new Date() } },
            { session },
        );
        if (result.matchedCount === 0) {
            throw new Error(`Announcement not found with ID: ${id}`);
        }
    }

    async softDelete(id: string, session?: ClientSession): Promise<void> {
        await this.init();
        const result = await this.announcementCollection.updateOne(
            { _id: new ObjectId(id), isDeleted: { $ne: true } },
            { $set: { isDeleted: true, deletedAt: new Date(), updatedAt: new Date() } },
            { session },
        );
        if (result.matchedCount === 0) {
            throw new Error(`Announcement not found with ID: ${id}`);
        }
    }

    async findForInstructor(
        filters: {
            type?: AnnouncementType;
            courseId?: string;
            courseVersionId?: string;
            instructorId?: string;
        },
        page: number = 1,
        limit: number = 10,
        session?: ClientSession,
    ): Promise<{ announcements: IAnnouncement[]; totalDocuments: number; totalPages: number }> {
        await this.init();

        const filter: any = { isDeleted: { $ne: true } };

        if (filters.type) {
            filter.type = filters.type;
        }
        if (filters.courseId) {
            const courseIdObj = ObjectId.isValid(filters.courseId)
                ? new ObjectId(filters.courseId)
                : null;
            filter.courseId = { $in: [filters.courseId, ...(courseIdObj ? [courseIdObj] : [])] };
        }
        if (filters.courseVersionId) {
            const versionIdObj = ObjectId.isValid(filters.courseVersionId)
                ? new ObjectId(filters.courseVersionId)
                : null;
            filter.courseVersionId = { $in: [filters.courseVersionId, ...(versionIdObj ? [versionIdObj] : [])] };
        }
        if (filters.instructorId) {
            const instructorIdObj = ObjectId.isValid(filters.instructorId)
                ? new ObjectId(filters.instructorId)
                : null;
            filter.instructorId = { $in: [filters.instructorId, ...(instructorIdObj ? [instructorIdObj] : [])] };
        }

        const skip = (page - 1) * limit;

        const [announcements, totalDocuments] = await Promise.all([
            this.announcementCollection.aggregate([
                { $match: filter },
                { $sort: { createdAt: -1 as const } },
                { $skip: skip },
                { $limit: limit },
                // Lookup Course
                {
                    $lookup: {
                        from: 'newCourse',
                        localField: 'courseId',
                        foreignField: '_id',
                        as: 'courseDetails'
                    }
                },
                // Lookup Course Version
                {
                    $lookup: {
                        from: 'newCourseVersion',
                        localField: 'courseVersionId',
                        foreignField: '_id',
                        as: 'versionDetails'
                    }
                },
                // Lookup Instructor for firebaseUID
                {
                    $lookup: {
                        from: 'users',
                        localField: 'instructorId',
                        foreignField: '_id',
                        as: 'instructorDetails'
                    }
                },
                // Add Fields
                {
                    $addFields: {
                        courseName: { $arrayElemAt: ['$courseDetails.name', 0] },
                        courseVersionName: { $arrayElemAt: ['$versionDetails.version', 0] },
                        instructorFirebaseUid: { $arrayElemAt: ['$instructorDetails.firebaseUID', 0] }
                    }
                },
                // Remove joined arrays
                {
                    $project: {
                        courseDetails: 0,
                        versionDetails: 0,
                        instructorDetails: 0
                    }
                }
            ], { session }).toArray(),
            this.announcementCollection.countDocuments(filter),
        ]);

        const totalPages = Math.ceil(totalDocuments / limit);

        const normalized = announcements.map(a => ({
            ...a,
            _id: a._id?.toString(),
            courseId: a.courseId?.toString(),
            courseVersionId: a.courseVersionId?.toString(),
            instructorId: a.instructorId?.toString(),
        })) as IAnnouncement[];

        return { announcements: normalized, totalDocuments, totalPages };
    }

    async findForStudent(
        enrollments: { courseId: string; versionId: string }[],
        page: number = 1,
        limit: number = 10,
        session?: ClientSession,
    ): Promise<{ announcements: IAnnouncement[]; totalDocuments: number; totalPages: number }> {
        await this.init();

        // Build OR conditions for student visibility
        const orConditions: any[] = [
            // GENERAL announcements are always visible
            { type: AnnouncementType.GENERAL },
        ];

        for (const enrollment of enrollments) {
            const courseIdObj = ObjectId.isValid(enrollment.courseId)
                ? new ObjectId(enrollment.courseId)
                : null;
            const versionIdObj = ObjectId.isValid(enrollment.versionId)
                ? new ObjectId(enrollment.versionId)
                : null;

            // COURSE_SPECIFIC: match courseId
            orConditions.push({
                type: AnnouncementType.COURSE_SPECIFIC,
                courseId: { $in: [enrollment.courseId, ...(courseIdObj ? [courseIdObj] : [])] },
            });

            // VERSION_SPECIFIC: match courseId + courseVersionId
            orConditions.push({
                type: AnnouncementType.VERSION_SPECIFIC,
                courseId: { $in: [enrollment.courseId, ...(courseIdObj ? [courseIdObj] : [])] },
                courseVersionId: { $in: [enrollment.versionId, ...(versionIdObj ? [versionIdObj] : [])] },
            });
        }

        const filter: any = {
            isDeleted: { $ne: true },
            isHidden: false,
            $or: orConditions,
        };

        const skip = (page - 1) * limit;

        const [announcements, totalDocuments] = await Promise.all([
            this.announcementCollection.aggregate([
                { $match: filter },
                { $sort: { createdAt: -1 as const } },
                { $skip: skip },
                { $limit: limit },
                // Lookup Course
                {
                    $lookup: {
                        from: 'newCourse',
                        localField: 'courseId',
                        foreignField: '_id',
                        as: 'courseDetails'
                    }
                },
                // Lookup Course Version
                {
                    $lookup: {
                        from: 'newCourseVersion',
                        localField: 'courseVersionId',
                        foreignField: '_id',
                        as: 'versionDetails'
                    }
                },
                // Lookup Instructor for firebaseUID
                {
                    $lookup: {
                        from: 'users',
                        localField: 'instructorId',
                        foreignField: '_id',
                        as: 'instructorDetails'
                    }
                },
                // Add Fields
                {
                    $addFields: {
                        courseName: { $arrayElemAt: ['$courseDetails.name', 0] },
                        courseVersionName: { $arrayElemAt: ['$versionDetails.version', 0] },
                        instructorFirebaseUid: { $arrayElemAt: ['$instructorDetails.firebaseUID', 0] }
                    }
                },
                // Remove joined arrays
                {
                    $project: {
                        courseDetails: 0,
                        versionDetails: 0,
                        instructorDetails: 0
                    }
                }
            ], { session }).toArray(),
            this.announcementCollection.countDocuments(filter),
        ]);

        const totalPages = Math.ceil(totalDocuments / limit);

        const normalized = announcements.map(a => ({
            ...a,
            _id: a._id?.toString(),
            courseId: a.courseId?.toString(),
            courseVersionId: a.courseVersionId?.toString(),
            instructorId: a.instructorId?.toString(),
        })) as IAnnouncement[];

        return { announcements: normalized, totalDocuments, totalPages };
    }
}
