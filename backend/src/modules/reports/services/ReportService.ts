import { BaseService, MongoDatabase } from '#root/shared/index.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { inject } from 'inversify';
import { REPORT_TYPES } from '../types.js';
import { IUser, IReport } from '#root/shared/index.js';
import { BadRequestError, NotFoundError } from 'routing-controllers';
import { ReportBody } from '#reports/classes/index.js';

@injectable()
export class ReportService extends BaseService {
    constructor(
        // @inject(REPORT_TYPES.ReportRepo)
        // private readonly courseRepo: ,
        @inject(GLOBAL_TYPES.Database)
        private readonly mongoDatabase: MongoDatabase,
    ) {
        super(mongoDatabase);
    }

    // async reportEntity(body: ReportBody): Promise<any> {
    //     // Prepare report object for storage in our database
    //     const report: Partial<IReport> = {
    //         courseId: body.courseId,
    //         courseVersionId: body.courseVersionId,
    //         entityId: body.entityId,
    //         entityTypeId: body.entityTypeId,
    //         email: body.email,
    //         firstName: body.firstName,
    //         lastName: body.lastName || '',
    //         roles: 'user',
    //     };

    //     let reportedEntityId: string;

    //     await this._withTransaction(async session => {
    //         const newReportEntity = new User(user);
    //         reportedEntityId = await this.userRepository.create(newReportEntity, session);
    //         if (!reportedEntityId) {
    //             throw new InternalServerError('Failed to create the user');
    //         }
    //     });

    //     let enrolledInvites: InviteResult[] = [];

    //     const invites = await this.inviteRepository.findInvitesByEmail(body.email);
    //     for (const invite of invites) {
    //         if (invite.inviteStatus === 'ACCEPTED') {
    //             const result = await this.enrollmentService.enrollUser(createdUserId.toString(), invite.courseId, invite.courseVersionId, invite.role, true);
    //             if (result && (result as any).enrollment) {
    //                 enrolledInvites.push(new InviteResult(
    //                     invite._id,
    //                     invite.email,
    //                     invite.inviteStatus,
    //                     invite.role,
    //                     invite.acceptedAt,
    //                     invite.courseId,
    //                     invite.courseVersionId,
    //                 ));
    //             }
    //         }
    //     }

    //     return enrolledInvites.length > 0 ? {
    //         userId: createdUserId,
    //         invites: enrolledInvites,
    //     } : {
    //         userId: createdUserId,
    //     };
    // }
}

