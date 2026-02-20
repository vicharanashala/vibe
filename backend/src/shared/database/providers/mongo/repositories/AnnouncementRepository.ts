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
        const announcement = await this.announcementCollection.findOne(
            { _id: new ObjectId(id), isDeleted: { $ne: true } },
            { session },
        );
        if (!announcement) return null;

        return {
            ...announcement,
            _id: announcement._id?.toString(),
            courseId: announcement.courseId?.toString(),
            courseVersionId: announcement.courseVersionId?.toString(),
            instructorId: announcement.instructorId?.toString(),
        };
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

        const skip = (page - 1) * limit;

        const [announcements, totalDocuments] = await Promise.all([
            this.announcementCollection
                .find(filter, { session })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            this.announcementCollection.countDocuments(filter),
        ]);

        const totalPages = Math.ceil(totalDocuments / limit);

        const normalized = announcements.map(a => ({
            ...a,
            _id: a._id?.toString(),
            courseId: a.courseId?.toString(),
            courseVersionId: a.courseVersionId?.toString(),
            instructorId: a.instructorId?.toString(),
        }));

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
            this.announcementCollection
                .find(filter, { session })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            this.announcementCollection.countDocuments(filter),
        ]);

        const totalPages = Math.ceil(totalDocuments / limit);

        const normalized = announcements.map(a => ({
            ...a,
            _id: a._id?.toString(),
            courseId: a.courseId?.toString(),
            courseVersionId: a.courseVersionId?.toString(),
            instructorId: a.instructorId?.toString(),
        }));

        return { announcements: normalized, totalDocuments, totalPages };
    }
}
