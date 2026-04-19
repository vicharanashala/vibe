import { injectable, inject } from 'inversify';
import {
  JsonController,
  Authorized,
  Post,
  Get,
  Delete,
  Body,
  Params,
  HttpCode,
  UploadedFile,
  OnUndefined,
  QueryParams,
  ForbiddenError,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { AnomalyService } from '../services/AnomalyService.js';
import { BadRequestErrorResponse } from '#shared/middleware/errorHandler.js';
import { ANOMALIES_TYPES } from '../types.js';
import { mediaUploadOptions } from '../classes/validators/fileUploadOptions.js';
import { AnomalyData, AnomalyIdParams, DeleteAnomalyBody, GetAnomalyParams, GetCourseAnomalyParams, GetItemAnomalyParams, GetUserAnomalyParams, NewAnomalyData, StatsQueryParams } from '../classes/validators/AnomalyValidators.js';
import { AnomalyDataResponse, AnomalyStats, FileType } from '../classes/transformers/Anomaly.js';
import { PaginationQuery } from '#root/shared/index.js';
import { Ability } from '#root/shared/functions/AbilityDecorator.js';
import { getAnomalyAbility } from '../abilities/anomalyAbilities.js';
import { subject } from '@casl/ability';

@OpenAPI({
  tags: ['Anomalies'],
  description: 'Operations for managing anomaly detection with encrypted image storage',
})
@injectable()
@JsonController('/anomalies')
export class AnomalyController {
  constructor(
    @inject(ANOMALIES_TYPES.AnomalyService) private anomalyService: AnomalyService,
  ) {}

  @OpenAPI({
    summary: 'Record anomaly',
    description: 'Records anomaly with optional image/audio.',
  })
  @Post('/record')
  @HttpCode(201)
  @Authorized()
  @ResponseSchema(AnomalyData, {
    description: 'Anomaly recorded successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async recordImageAnomaly(
    @UploadedFile("file", {options: mediaUploadOptions})
      file: Express.Multer.File,
    @Body() body: NewAnomalyData,
    @Ability(getAnomalyAbility) {ability, user}
  ): Promise<AnomalyData> {
    const { courseId, versionId } = body;
    const userId = user._id.toString();
    const anomalyRes = subject('Anomaly', { courseId, versionId });

    if (!ability.can('create', anomalyRes)) {
      throw new ForbiddenError('You do not have permission to create an anomaly');
    }
    const fileType = file?.mimetype.startsWith("image/") ? FileType.IMAGE : FileType.AUDIO;

    return this.anomalyService.recordAnomaly(userId, body, file, fileType);
  }

  @OpenAPI({
    summary: 'Get a particular anomaly',
    description: 'Retrieves a specific anomaly for a user',
  })
  @Get('/:anomalyId/course/:courseId/version/:versionId')
  @Authorized()
  @ResponseSchema(AnomalyDataResponse)
  async getAnomaly(
    @Params() params: GetAnomalyParams,
    @Ability(getAnomalyAbility) {ability}
  ): Promise<AnomalyDataResponse> {
    const { courseId, versionId, anomalyId } = params;

    const anomalyRes = subject('Anomaly', { courseId, versionId });
    if (!ability.can('view', anomalyRes)) {
      throw new ForbiddenError('You do not have permission to view this anomaly');
    }
    const anomaly = await this.anomalyService.findAnomalyById(anomalyId, courseId, versionId);
    return anomaly;
  }

  @OpenAPI({
    summary: 'Get user anomalies with filtering and pagination',
    description: 'Retrieves anomalies for a specific user with optional filtering by course, module, section, item, type, date range, and pagination support. Captures Accept header for potential content negotiation.',
  })
  @Get('/course/:courseId/version/:versionId/user/:userId')
  @Authorized()
  @ResponseSchema(AnomalyData)
  async getUserAnomalies(
    @Params() params: GetUserAnomalyParams,
    @QueryParams() query: PaginationQuery,
    @Ability(getAnomalyAbility) {ability}
  ): Promise<AnomalyData[]> {
    const { courseId, versionId, userId } = params;
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const anomalyRes = subject('Anomaly', { courseId, versionId });
    if (!ability.can('view', anomalyRes)) {
      throw new ForbiddenError('You do not have permission to view anomalies for this user');
    }
    const anomalies = await this.anomalyService.getUserAnomalies(userId, courseId, versionId, limit, skip);

    return anomalies;
  }

  @OpenAPI({
    summary: 'Get course anomalies',
    description: 'Retrieves all anomalies for a specific course',
  })
  @Get('/course/:courseId/version/:versionId')
  @Authorized()
  @ResponseSchema(AnomalyData)
  async getCourseAnomalies(
    @Params() params: GetCourseAnomalyParams,
    @QueryParams() query: PaginationQuery,
    @Ability(getAnomalyAbility) {ability}
  ): Promise<AnomalyData[]> {
    const { courseId, versionId } = params;
    const { page, limit } =  query
    const skip = (page - 1) * limit;

    const anomalyRes = subject('Anomaly', { courseId, versionId });
    if (!ability.can('view', anomalyRes)) {
      throw new ForbiddenError('You do not have permission to view anomalies for this course');
    }

    const anomalies = await this.anomalyService.getCourseAnomalies(courseId, versionId, limit, skip);

    return anomalies;
  }

  @OpenAPI({
  summary: 'Get Item anomalies',
  description: 'Retrieves all anomalies for a specific item',
  })
  @Get('/course/:courseId/version/:versionId/item/:itemId')
  @Authorized()
  @ResponseSchema(AnomalyData)
  async getItemAnomalies(
    @Params() params: GetItemAnomalyParams,
    @QueryParams() query: PaginationQuery,
    @Ability(getAnomalyAbility) {ability}
  ): Promise<AnomalyData[]> {
    const { courseId, versionId, itemId } = params;
    const { page, limit } =  query
    const skip = (page - 1) * limit;

    const anomalyRes = subject('Anomaly', { courseId, versionId, itemId });
    if (!ability.can('view', anomalyRes)) {
      throw new ForbiddenError('You do not have permission to view anomalies for this item');
    }

    const anomalies = await this.anomalyService.getCourseItemAnomalies(courseId, versionId, itemId, limit, skip);

    return anomalies;
  }

  @OpenAPI({
    summary: 'Get anomaly statistics',
    description: 'Retrieves statistics for a specific anomaly item',
  })
  @Get('/course/:courseId/version/:versionId/stats')
  @Authorized()
  @ResponseSchema(AnomalyStats)
  async getAnomalyStats(
    @Params() params: GetCourseAnomalyParams,
    @QueryParams() query: StatsQueryParams,
    @Ability(getAnomalyAbility) {ability}
  ): Promise<AnomalyStats> {
    const { courseId, versionId } = params;
    const { userId, itemId } = query;

    const anomalyRes = subject('Anomaly', { courseId, versionId });
    if (!ability.can('view', anomalyRes)) {
      throw new ForbiddenError('You do not have permission to view anomaly statistics for this course');
    }

    return this.anomalyService.getAnomalyStats(courseId, versionId, userId, itemId);
  }

  @OpenAPI({
    summary: 'Delete anomaly',
    description: 'Deletes an anomaly record and its encrypted image',
  })
  @Delete('/:id')
  @Authorized()
  @OnUndefined(200)
  async deleteAnomaly(
    @Params() params: AnomalyIdParams,
    @Body() body: DeleteAnomalyBody,
    @Ability(getAnomalyAbility) {ability}
  ): Promise<void> {
    const { courseId, versionId } = body;

    const anomalyRes = subject('Anomaly', { courseId, versionId });
    if (!ability.can('delete', anomalyRes)) {
      throw new ForbiddenError('You do not have permission to delete this anomaly');
    }

    await this.anomalyService.deleteAnomaly(params.id, courseId, versionId);
  }
}