import {inject, injectable} from 'inversify';
import {
  Authorized,
  Body,
  ForbiddenError,
  Get,
  HttpCode,
  JsonController,
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
  ReportDataResponse,
  ReportFiltersQuery,
  ReportIdParams,
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
  @ResponseSchema(ReportDataResponse, {
    description: 'Report created successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async create(
    @Body() body: ReportBody,
    @Ability(getCourseAbility) {ability, user},
  ): Promise<Report | null> {
    const {courseId, entityId, entityType, reason, versionId} = body;
    const reportedBy = user.userId;
    const reportResource = subject(ReportPermissionSubject.REPORT, {
      courseId,
      versionId,
      reportedBy,
    });

    if (!ability.can(ReportsActions.Create, reportResource)) {
      throw new ForbiddenError(
        'You do not have permission to view this course',
      );
    }

    await this.reportService.createReport(
      courseId,
      versionId,
      entityId,
      entityType,
      reportedBy,
      reason,
    );
    return null;
  }

  @OpenAPI({
    summary: 'Update report status',
    description: 'Updates the status of an existing report',
  })
  @Authorized()
  @Patch('/:reportId', {transformResponse: true})
  @HttpCode(200)
  @ResponseSchema(ReportDataResponse, {
    description: 'Report status updated successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async updateStatus(
    @Params() params: ReportIdParams,
    @Body() body: UpdateReportStatusBody,
    @Ability(getCourseAbility) {ability, user},
  ): Promise<Report | null> {
    return null;
  }

  @OpenAPI({
    summary: 'Get filtered reports',
    description: 'Retrieves reports based on filtering criteria',
  })
  @Authorized()
  @Get('/')
  @HttpCode(200)
  @ResponseSchema(ReportDataResponse, {isArray: true})
  async getFilteredReports(
    @QueryParams() filters: ReportFiltersQuery,
    @Ability(getCourseAbility) {ability, user},
  ): Promise<Report[]> {
    return [];
  }
}

export {ReportController};
