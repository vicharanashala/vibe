import 'reflect-metadata'
import {
  BaseService,
  EntityType,
  ID,
  IStatus,
  MongoDatabase,
  ReportStatus,
} from '#root/shared/index.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {inject, injectable} from 'inversify';
import {REPORT_TYPES} from '../types.js';
import {NotFoundError} from 'routing-controllers';
import {
  Report,
  ReportDataResponse,
  ReportFiltersQuery,
  ReportResponse,
} from '../classes/index.js';
import {ReportRepository} from '../repositories/index.js';
import {plainToInstance} from 'class-transformer';

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

  async createReport(report: Report): Promise<void> {
    return this._withTransaction(async session => {
      // Flag the question with the reason and user ID
      await this.reportsRepository.create(report, session);
    });
  }

  async updateReport(
    reportId: string,
    status: ReportStatus,
    comment: string,
  ): Promise<void> {
    return this._withTransaction(async session => {
      const report = await this.reportsRepository.getById(reportId, session);
      if (!report) {
        throw new NotFoundError('Report does not exist.');
      }
      const newStatus: IStatus = {
        status,
        comment,
      };
      await this.reportsRepository.update(reportId, newStatus, session);
    });
  }

  async getReportsByCourseId(
    courseId: string,
    filters: ReportFiltersQuery,
  ): Promise<ReportResponse> {
    return this._withTransaction(async _ => {
      return await this.reportsRepository.getByCourseId(courseId, filters);
    });
  }

  async getReportById(reportId: string): Promise<ReportDataResponse> {
    const report = await this.reportsRepository.getById(reportId);
    const reportInstance = plainToInstance(ReportDataResponse, report);
    return reportInstance
  }
}
