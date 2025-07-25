import { BaseService, EntityType, ID, IStatus, MongoDatabase } from '#root/shared/index.js';
import { GLOBAL_TYPES } from '#root/types.js';
import { inject, injectable } from 'inversify';
import { REPORT_TYPES } from '../types.js';
import { IUser, IReport } from '#root/shared/index.js';
import { BadRequestError, NotFoundError } from 'routing-controllers';
import { ReportBody } from '../classes/index.js';
import { ReportRepository } from '../repositories/index.js';

@injectable()
export class ReportService extends BaseService {
    constructor(
        @inject(REPORT_TYPES.ReportRepo)
        private reportsRepository: ReportRepository,
        @inject(GLOBAL_TYPES.Database)
        private readonly mongoDatabase: MongoDatabase,
    ) {
        super(mongoDatabase);
    }

    public async createReport(
        courseId: ID,
        versionId: ID,
        entityId: ID,
        entityType: EntityType,
        reportedBy: string,
        reason: string,

    ): Promise<void> {
        return this._withTransaction(async session => {
            // const question = await this.re.getById(
            //     questionId,
            //     session,
            // );
            // if (!question) {
            //     throw new NotFoundError(`Question with ID ${questionId} not found`);
            // }

            // Flag the question with the reason and user ID
            await this.reportsRepository.create(
                {
                    entityId,
                    entityType,
                    reportedBy,
                    reason,
                    courseId,
                    versionId,
                }, session
            );
        });
    }
}

