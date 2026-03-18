import 'reflect-metadata';
import {
  BaseService,
  EntityType,
  ICourseRepository,
  ID,
  IStatus,
  MongoDatabase,
  ReportStatus,
} from '#root/shared/index.js';
import {GLOBAL_TYPES} from '#root/types.js';
import {inject, injectable} from 'inversify';
import {REPORT_TYPES} from '../types.js';
import {ForbiddenError, NotFoundError} from 'routing-controllers';
import {
  IssueSortEnum,
  IssueStatusEnum,
  // MyFlagFiltersQuery,
  Report,
  ReportDataResponse,
  ReportFiltersQuery,
  ReportResponse,
} from '../classes/index.js';
import {ReportRepository} from '../repositories/index.js';
import {plainToInstance} from 'class-transformer';
import { ObjectId } from 'mongodb';

@injectable()
export class ReportService extends BaseService {
  constructor(
    @inject(REPORT_TYPES.ReportRepo)
    private reportsRepository: ReportRepository,

    @inject(GLOBAL_TYPES.Database)
    private readonly mongoDatabase: MongoDatabase,

    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: ICourseRepository,
  ) {
    super(mongoDatabase);
  }

  async createReport(report: Report): Promise<void> {
    return this._withTransaction(async session => {
      const versionStatus = await this.courseRepo.getCourseVersionStatus(
        report.versionId.toString(),
      );

      if (versionStatus === 'archived') {
        throw new ForbiddenError(
          "This course version is inactive, you can't submit flags",
        );
      }
      // Flag the question with the reason and user ID
      await this.reportsRepository.create(report, session);
    });
  }

  async updateReport(
    reportId: string,
    status: ReportStatus,
    comment: string,
    createdBy: string,
  ): Promise<void> {
    return this._withTransaction(async session => {
      const report = await this.reportsRepository.getById(reportId, session);
      if (!report) {
        throw new NotFoundError('Report does not exist.');
      }
      const versionStatus = await this.courseRepo.getCourseVersionStatus(
        report.versionId.toString(),
      );

      if (versionStatus === 'archived') {
        throw new ForbiddenError(
          "This course version is inactive, you can't update flags",
        );
      }
      const newStatus: IStatus = {
        status,
        comment,
        createdBy: new ObjectId(createdBy),
        createdAt: new Date(),
      };
      await this.reportsRepository.update(reportId, newStatus, session);
    });
  }

  async getReportsByCourse(
    courseId: string,
    versionId: string,
    filters: ReportFiltersQuery,
  ): Promise<ReportResponse> {
    return this._withTransaction(async _ => {
      const result = await this.reportsRepository.getByCourse(
        courseId,
        versionId,
        filters,
      );
      return result;
    });
  }

  async getReportById(reportId: string): Promise<ReportDataResponse> {
    const report = await this.reportsRepository.getById(reportId);
    const reportInstance = plainToInstance(ReportDataResponse, report);
    return reportInstance;
  }

  // async getMyFlags(userId:string,filters:MyFlagFiltersQuery){
  //   return this._withTransaction(async session => {
  //     const result = await this.reportsRepository.getByUserId(userId,filters,session)
  //     return result
  //   })
  // }

  async getMyIssueReports(
    userId: string,
    page: number,
    limit: number,
    status: IssueStatusEnum,
    search: string,
    sort: any,
  ) {
    return this._withTransaction(async session => {
      const skip = (page - 1) * limit;

      const {issues, totalDocuments} =
        await this.reportsRepository.findReportsByUser(
          userId,
          {status, search, sort},
          skip,
          limit,
          session,
        );

      return {
        issues,
        totalDocuments,
        totalPages: Math.ceil(totalDocuments / limit),
        currentPage: page,
      };
    });
  }

  updateStudentInterset(id: string, interest: string) {
    return this._withTransaction(async session => {
      const report = await this.reportsRepository.getById(id, session);
      if (!report) {
        throw new NotFoundError('Report does not exist.');
      }
      const versionStatus = await this.courseRepo.getCourseVersionStatus(
        report.versionId.toString(),
      );

      if (versionStatus === 'archived') {
        throw new ForbiddenError(
          "This course version is inactive, you can't Student flags",
        );
      }
      const result = await this.reportsRepository.updateInterest(
        id,
        interest,
        session,
      );
      return result;
    });
  }
}
