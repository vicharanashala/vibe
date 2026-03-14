import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import { ANNOUNCEMENTS_TYPES } from '../types.js';
import { AnnouncementRepository } from '#shared/database/providers/mongo/repositories/AnnouncementRepository.js';
import {
    IAnnouncement,
    AnnouncementType,
    IAnnouncementAttachment,
} from '#root/shared/interfaces/models.js';
import { BadRequestError, NotFoundError } from 'routing-controllers';
import { ObjectId } from 'mongodb';

@injectable()
export class AnnouncementService {
    constructor(
        @inject(ANNOUNCEMENTS_TYPES.AnnouncementRepo)
        private readonly announcementRepo: AnnouncementRepository,
    ) { }

    async createAnnouncement(
        data: {
            title: string;
            content: string;
            type: AnnouncementType;
            courseId?: string;
            courseVersionId?: string;
            attachments?: IAnnouncementAttachment[];
            cohortId?: string;
        },
        instructorId: string,
        instructorName: string,
        instructorFirebaseUid: string,
    ): Promise<IAnnouncement> {
        // Validate type constraints
        if (
            (data.type === AnnouncementType.COURSE_SPECIFIC ||
                data.type === AnnouncementType.VERSION_SPECIFIC) &&
            !data.courseId
        ) {
            throw new BadRequestError(
                'courseId is required for COURSE_SPECIFIC and VERSION_SPECIFIC announcements',
            );
        }

        if (data.type === AnnouncementType.VERSION_SPECIFIC && !data.courseVersionId) {
            throw new BadRequestError(
                'courseVersionId is required for VERSION_SPECIFIC announcements',
            );
        }

        const now = new Date();
        const announcement: IAnnouncement = {
            title: data.title,
            content: data.content,
            type: data.type,
            courseId: data.type !== AnnouncementType.GENERAL && data.courseId ? new ObjectId(data.courseId) : undefined,
            courseVersionId:
                data.type === AnnouncementType.VERSION_SPECIFIC && data.courseVersionId
                    ? new ObjectId(data.courseVersionId)
                    : undefined,
            cohortId: data.type === AnnouncementType.COHORT_SPECIFIC && data.cohortId ? new ObjectId(data.cohortId) : undefined,
            instructorId: new ObjectId(instructorId),
            instructorName,
            instructorFirebaseUid,
            attachments: data.attachments || [],
            isHidden: false,
            isDeleted: false,
            createdAt: now,
            updatedAt: now,
        };

        const id = await this.announcementRepo.create(announcement);
        return { ...announcement, _id: id };
    }

    async updateAnnouncement(
        announcementId: string,
        data: Partial<IAnnouncement>,
    ): Promise<void> {
        const existing = await this.announcementRepo.findById(announcementId);
        if (!existing) {
            throw new NotFoundError('Announcement not found');
        }

        // If type is being changed, validate constraints
        const effectiveType = data.type || existing.type;
        const effectiveCourseId = data.courseId !== undefined ? data.courseId : existing.courseId;
        const effectiveVersionId =
            data.courseVersionId !== undefined ? data.courseVersionId : existing.courseVersionId;

        if (
            (effectiveType === AnnouncementType.COURSE_SPECIFIC ||
                effectiveType === AnnouncementType.VERSION_SPECIFIC) &&
            !effectiveCourseId
        ) {
            throw new BadRequestError(
                'courseId is required for COURSE_SPECIFIC and VERSION_SPECIFIC announcements',
            );
        }

        if (effectiveType === AnnouncementType.VERSION_SPECIFIC && !effectiveVersionId) {
            throw new BadRequestError(
                'courseVersionId is required for VERSION_SPECIFIC announcements',
            );
        }

        const updateData: Partial<IAnnouncement> = { ...data };
        if (updateData.courseId) {
            updateData.courseId = new ObjectId(updateData.courseId) as any;
        }
        if (updateData.courseVersionId) {
            updateData.courseVersionId = new ObjectId(updateData.courseVersionId) as any;
        }

        await this.announcementRepo.update(announcementId, updateData);
    }

    async toggleHideAnnouncement(announcementId: string): Promise<boolean> {
        const existing = await this.announcementRepo.findById(announcementId);
        if (!existing) {
            throw new NotFoundError('Announcement not found');
        }

        const newHiddenState = !existing.isHidden;
        await this.announcementRepo.update(announcementId, {
            isHidden: newHiddenState,
        });
        return newHiddenState;
    }

    async deleteAnnouncement(announcementId: string): Promise<void> {
        const existing = await this.announcementRepo.findById(announcementId);
        if (!existing) {
            throw new NotFoundError('Announcement not found');
        }
        await this.announcementRepo.softDelete(announcementId);
    }

    async getAnnouncementsForInstructor(
        filters: {
            type?: AnnouncementType;
            courseId?: string;
            courseVersionId?: string;
            instructorId?: string;
            cohortId?: string;
        },
        page: number = 1,
        limit: number = 10,
    ) {
        return this.announcementRepo.findForInstructor(filters, page, limit);
    }

    async getAnnouncementsForStudent(
        enrollments: { courseId: string; versionId: string, cohortId?: string }[],
        page: number = 1,
        limit: number = 10,
    ) {
        return this.announcementRepo.findForStudent(enrollments, page, limit);
    }

    async getAnnouncementById(announcementId: string): Promise<IAnnouncement> {
        const announcement = await this.announcementRepo.findById(announcementId);
        if (!announcement) {
            throw new NotFoundError('Announcement not found');
        }
        return announcement;
    }
}
