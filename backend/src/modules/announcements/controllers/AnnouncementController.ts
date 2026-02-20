import 'reflect-metadata';
import {
    JsonController,
    Post,
    Patch,
    Delete,
    Get,
    HttpCode,
    Params,
    Body,
    Authorized,
    CurrentUser,
    QueryParams,
    ForbiddenError,
} from 'routing-controllers';
import { injectable, inject } from 'inversify';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Ability } from '#root/shared/functions/AbilityDecorator.js';
import { subject } from '@casl/ability';
import { ANNOUNCEMENTS_TYPES } from '../types.js';
import { AnnouncementService } from '../services/AnnouncementService.js';
import {
    AnnouncementActions,
    getAnnouncementAbility,
} from '../abilities/announcementAbilities.js';
import {
    CreateAnnouncementBody,
    UpdateAnnouncementBody,
    AnnouncementIdParams,
    AnnouncementQueryParams,
} from '../classes/validators/AnnouncementValidators.js';
import {
    AnnouncementResponse,
    AnnouncementMessageResponse,
} from '../classes/transformers/Announcement.js';
import { AnnouncementType } from '#root/shared/interfaces/models.js';
import { IUser } from '#root/shared/interfaces/models.js';


@OpenAPI({
    tags: ['Announcements'],
})
@JsonController('/announcements', { transformResponse: true })
@injectable()
export class AnnouncementController {
    constructor(
        @inject(ANNOUNCEMENTS_TYPES.AnnouncementService)
        private readonly announcementService: AnnouncementService,
    ) { }

    
    //Create a new announcement
     
    @Authorized()
    @Post('/')
    @HttpCode(201)
    @OpenAPI({
        summary: 'Create an announcement',
        description:
            'Create a new announcement. Instructors and managers can create announcements for their courses or general ones.',
    })
    async createAnnouncement(
        @Body() body: CreateAnnouncementBody,
        @Ability(getAnnouncementAbility) { ability, user },
    ) {
        // Check permission based on announcement type
        if (body.type === AnnouncementType.GENERAL) {
            if (!ability.can(AnnouncementActions.Create, 'Announcement')) {
                throw new ForbiddenError(
                    'You do not have permission to create announcements',
                );
            }
        } else {
            const announcementSubject = subject('Announcement', {
                courseId: body.courseId,
            });
            if (!ability.can(AnnouncementActions.Create, announcementSubject)) {
                throw new ForbiddenError(
                    'You do not have permission to create announcements for this course',
                );
            }
        }

        const instructorName = `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`;
        const announcement = await this.announcementService.createAnnouncement(
            body,
            user._id.toString(),
            instructorName,
        );

        return announcement;
    }

    
    //Update an existing announcement
    
    @Authorized()
    @Patch('/:announcementId')
    @HttpCode(200)
    @OpenAPI({
        summary: 'Update an announcement',
        description: 'Update an existing announcement by ID.',
    })
    async updateAnnouncement(
        @Params() params: AnnouncementIdParams,
        @Body() body: UpdateAnnouncementBody,
        @Ability(getAnnouncementAbility) { ability, user },
    ) {
        const existing = await this.announcementService.getAnnouncementById(
            params.announcementId,
        );

        if (existing.instructorId?.toString() !== user._id.toString()) {
            throw new ForbiddenError('You can only modify your own announcements');
        }

        // Check permission
        if (existing.type === AnnouncementType.GENERAL) {
            if (!ability.can(AnnouncementActions.Update, 'Announcement')) {
                throw new ForbiddenError(
                    'You do not have permission to update this announcement',
                );
            }
        } else {
            const announcementSubject = subject('Announcement', {
                courseId: existing.courseId?.toString(),
            });
            if (!ability.can(AnnouncementActions.Update, announcementSubject)) {
                throw new ForbiddenError(
                    'You do not have permission to update this announcement',
                );
            }
        }

        await this.announcementService.updateAnnouncement(
            params.announcementId,
            body,
        );

        return new AnnouncementMessageResponse('Announcement updated successfully');
    }

    
    //Toggle announcement visibility (hide/show)
    
    @Authorized()
    @Patch('/:announcementId/toggle-hide')
    @HttpCode(200)
    @OpenAPI({
        summary: 'Toggle hide/show announcement',
        description: 'Toggle the visibility of an announcement.',
    })
    async toggleHideAnnouncement(
        @Params() params: AnnouncementIdParams,
        @Ability(getAnnouncementAbility) { ability, user },
    ) {
        const existing = await this.announcementService.getAnnouncementById(
            params.announcementId,
        );

        if (existing.instructorId?.toString() !== user._id.toString()) {
            throw new ForbiddenError('You can only modify your own announcements');
        }

        if (existing.type === AnnouncementType.GENERAL) {
            if (!ability.can(AnnouncementActions.Update, 'Announcement')) {
                throw new ForbiddenError(
                    'You do not have permission to modify this announcement',
                );
            }
        } else {
            const announcementSubject = subject('Announcement', {
                courseId: existing.courseId?.toString(),
            });
            if (!ability.can(AnnouncementActions.Update, announcementSubject)) {
                throw new ForbiddenError(
                    'You do not have permission to modify this announcement',
                );
            }
        }

        const isHidden = await this.announcementService.toggleHideAnnouncement(
            params.announcementId,
        );

        return {
            message: isHidden
                ? 'Announcement is now hidden'
                : 'Announcement is now visible',
            isHidden,
        };
    }

    
    //Soft delete an announcement
    
    @Authorized()
    @Delete('/:announcementId')
    @HttpCode(200)
    @OpenAPI({
        summary: 'Delete an announcement',
        description: 'Soft-delete an announcement by ID.',
    })
    async deleteAnnouncement(
        @Params() params: AnnouncementIdParams,
        @Ability(getAnnouncementAbility) { ability, user },
    ) {
        const existing = await this.announcementService.getAnnouncementById(
            params.announcementId,
        );

        if (existing.instructorId?.toString() !== user._id.toString()) {
            throw new ForbiddenError('You can only delete your own announcements');
        }

        if (existing.type === AnnouncementType.GENERAL) {
            if (!ability.can(AnnouncementActions.Delete, 'Announcement')) {
                throw new ForbiddenError(
                    'You do not have permission to delete this announcement',
                );
            }
        } else {
            const announcementSubject = subject('Announcement', {
                courseId: existing.courseId?.toString(),
            });
            if (!ability.can(AnnouncementActions.Delete, announcementSubject)) {
                throw new ForbiddenError(
                    'You do not have permission to delete this announcement',
                );
            }
        }

        await this.announcementService.deleteAnnouncement(params.announcementId);
        return new AnnouncementMessageResponse('Announcement deleted successfully');
    }

    
    //Get announcements for instructor (includes hidden)
    
    @Authorized()
    @Get('/instructor')
    @HttpCode(200)
    @OpenAPI({
        summary: 'Get announcements for instructor',
        description:
            'Retrieve announcements with filters. Includes hidden announcements.',
    })
    async getAnnouncementsForInstructor(
        @QueryParams() query: AnnouncementQueryParams,
        @Ability(getAnnouncementAbility) { ability, user },
    ) {
        if (!ability.can(AnnouncementActions.Create, 'Announcement')) {
            throw new ForbiddenError(
                'You do not have permission to view instructor announcements',
            );
        }

        const { page, limit, type, courseId, courseVersionId } = query;

        const result = await this.announcementService.getAnnouncementsForInstructor(
            { type, courseId, courseVersionId, instructorId: user._id.toString() },
            page,
            limit,
        );

        return new AnnouncementResponse(
            result.announcements,
            result.totalDocuments,
            result.totalPages,
        );
    }

    
    //Get announcements for student (filtered by enrollments, excludes hidden)
    
    @Authorized()
    @Get('/student')
    @HttpCode(200)
    @OpenAPI({
        summary: 'Get announcements for student',
        description:
            'Retrieve announcements visible to the current student based on their enrollments. Excludes hidden announcements.',
    })
    async getAnnouncementsForStudent(
        @QueryParams() query: AnnouncementQueryParams,
        @Ability(getAnnouncementAbility) { ability, user },
    ) {
        const { page, limit } = query;

        // Build enrollments list from ability context
        // The ability decorator already provides the user's enrollments
        const enrollmentService = await import(
            '#root/modules/users/services/EnrollmentService.js'
        );
        const { getFromContainer } = await import('routing-controllers');
        const enrollService = getFromContainer(
            enrollmentService.EnrollmentService,
        );
        const enrollments = await enrollService.getAllEnrollments(
            user._id.toString(),
        );

        const enrollmentData = enrollments.map((e: any) => ({
            courseId: e.courseId.toString(),
            versionId: e.courseVersionId.toString(),
        }));

        const result = await this.announcementService.getAnnouncementsForStudent(
            enrollmentData,
            page,
            limit,
        );

        return new AnnouncementResponse(
            result.announcements,
            result.totalDocuments,
            result.totalPages,
        );
    }
}
