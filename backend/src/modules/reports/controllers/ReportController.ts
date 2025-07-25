import {inject, injectable} from 'inversify';
import {
  Authorized,
  Body,
  ForbiddenError,
  Get,
  HttpCode,
  JsonController,
  Param,
  Params,
  Patch,
  Post,
  QueryParams,
} from 'routing-controllers';
import {OpenAPI, ResponseSchema} from 'routing-controllers-openapi';
import {REPORT_TYPES} from '../types.js';
import {ReportService} from '../services/ReportService.js';
import {
  Report,
  ReportBody,
  ReportFiltersQuery,
  ReportResponse,
  ReportUpdateParams,
  UpdateReportStatusBody,
} from '../classes/index.js';
import {Ability} from '#root/shared/functions/AbilityDecorator.js';
import {getCourseAbility} from '#root/modules/courses/abilities/courseAbilities.js';
import {BadRequestErrorResponse, IReport} from '#root/shared/index.js';
import {ReportsActions} from '../abilities/reportsAbilities.js';
import {ReportPermissionSubject} from '../constants.js';
import {subject} from '@casl/ability';

@OpenAPI({
  tags: ['Reports'],
  description: 'Operations for managing course reports in the system',
})
@injectable()
@JsonController('/reports')
class ReportController {
  constructor(
    @inject(REPORT_TYPES.ReportService)
    private readonly reportService: ReportService,
  ) {}

  @OpenAPI({
    summary: 'Create a new report',
    description: 'Creates a new report in the system.',
  })
  @Authorized()
  @Post('/', {transformResponse: true})
  @HttpCode(201)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async create(
    @Body() body: ReportBody,
    @Ability(getCourseAbility) {ability, user},
  ): Promise<void> {
    const {courseId, versionId} = body;
    const reportedBy = user.userId;
    const reportResource = subject(ReportPermissionSubject.REPORT, {
      courseId,
      versionId,
      reportedBy,
    });

    if (!ability.can(ReportsActions.Create, reportResource)) {
      throw new ForbiddenError(
        'You do not have permission to create this report',
      );
    }
    const report = new Report(body, reportedBy);
    await this.reportService.createReport(report);
  }

  @OpenAPI({
    summary: 'Update report status',
    description: 'Updates the status of an existing report',
  })
  @Authorized()
  @Patch('/:reportId', {transformResponse: true})
  @HttpCode(200)
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async updateStatus(
    @Params() params: ReportUpdateParams,
    @Body() body: UpdateReportStatusBody,
    @Ability(getCourseAbility) {ability, user},
  ): Promise<void> {
    const {reportId} = params;
    const {status, comment} = body;
    const reportResource = subject(ReportPermissionSubject.REPORT, {reportId});

    if (!ability.can(ReportsActions.Modify, reportResource)) {
      throw new ForbiddenError(
        'You do not have permission to update this report',
      );
    }

    await this.reportService.updateReport(reportId, status, comment);
  }

  @OpenAPI({
    summary: 'Get filtered reports',
    description: 'Retrieves reports based on filtering criteria',
  })
  @Authorized()
  @Get('/:courseId')
  @HttpCode(200)
  @ResponseSchema(ReportResponse, {isArray: true})
  async getFilteredReports(
    @Param('courseId') courseId: string,
    @QueryParams() filters: ReportFiltersQuery,
    @Ability(getCourseAbility) {ability, user},
  ): Promise<ReportResponse> {
    const reportResource = subject(ReportPermissionSubject.REPORT, {courseId});

    if (!ability.can(ReportsActions.View, reportResource)) {
      throw new ForbiddenError(
        'You do not have permission to view reports for this course',
      );
    }
    const result = await this.reportService.getReport(courseId, filters);
    return result;
  }
}

export {ReportController};
