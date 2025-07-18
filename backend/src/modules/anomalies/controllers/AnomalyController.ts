import { injectable, inject } from 'inversify';
import {
  JsonController,
  Authorized,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Params,
  QueryParams,
  Header,
  HttpCode,
  UploadedFile,
  Res,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Response } from 'express';
import { AnomalyService } from '../services/AnomalyService.js';
import { AnomalyTransformationService } from '../services/AnomalyTransformationService.js';
import { AnomalyDecryptionService } from '../services/AnomalyDecryptionService.js';
import { 
  CreateAnomalyBody, 
  AnomalyIdParams, 
  UserIdParams,
  CourseIdParams,
  SessionIdParams,
  ExamIdParams,
  MultipartAnomalyData,
  GetUserAnomaliesQuery,
  AnomalyDataResponse,
  AnomalyStatsResponse 
} from '../classes/validators/AnomalyValidators.js';
import { BadRequestErrorResponse } from '#shared/middleware/errorHandler.js';
import { ANOMALIES_TYPES } from '../types.js';

@OpenAPI({
  tags: ['Anomalies'],
  description: 'Operations for managing anomaly detection with encrypted image storage',
})
@injectable()
@JsonController('/anomalies')
export class AnomalyController {
  constructor(
    @inject(ANOMALIES_TYPES.AnomalyService) private anomalyService: AnomalyService,
    @inject(ANOMALIES_TYPES.AnomalyTransformationService) private transformationService: AnomalyTransformationService,
  ) {}

  @OpenAPI({
    summary: 'Record anomaly with encrypted image',
    description: 'Records an anomaly with compressed and encrypted image stored in cloud storage. Captures User-Agent header for session metadata.',
  })
  @Post('/record')
  @HttpCode(201)
  @ResponseSchema(AnomalyDataResponse, {
    description: 'Anomaly recorded successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async recordAnomaly(
    @UploadedFile('image') file: any,
    @Body() body: MultipartAnomalyData,
    @Header('user-agent', 'userAgent') userAgent: string
  ): Promise<{
    success: boolean;
    hexId: string;
    message: string;
    endpoints: {
      decrypt: string;
      viewImage: string;
      latest: string;
    };
    data: any;
  }> {
    const completeAnomalyData = this.transformationService.prepareAnomalyData(file, body);
    const dataWithUserAgent = this.transformationService.addUserAgent(completeAnomalyData, userAgent);
    const result = await this.anomalyService.recordAnomaly(dataWithUserAgent);
    
    return this.transformationService.buildRecordResponse(result);
  }

  @OpenAPI({
    summary: 'Get user anomalies with filtering and pagination',
    description: 'Retrieves anomalies for a specific user with optional filtering by course, module, section, item, type, date range, and pagination support. Captures Accept header for potential content negotiation.',
  })
  @Get('/user/:userId')
  @Authorized()
  @ResponseSchema(AnomalyDataResponse)
  async getUserAnomalies(
    @Params() params: UserIdParams,
    @QueryParams() query: GetUserAnomaliesQuery,
    @Header('accept', 'accept') accept?: string
  ): Promise<{
    success: boolean;
    data: any[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
    };
    filters: any;
  }> {
    const filters = this.transformationService.buildFiltersFromQuery(query);
    const anomalies = await this.anomalyService.getUserAnomalies(params.userId, filters);
    const transformedAnomalies = this.transformationService.transformAnomalies(anomalies);
    
    return {
      success: true,
      data: transformedAnomalies,
      filters
    };
  }

  @OpenAPI({
    summary: 'Get session anomalies',
    description: 'Retrieves all anomalies for a specific session',
  })
  @Get('/session/:sessionId')
  @Authorized()
  @ResponseSchema(AnomalyDataResponse)
  async getSessionAnomalies(@Params() params: SessionIdParams): Promise<{
    success: boolean;
    data: any[];
  }> {
    const anomalies = await this.anomalyService.getUserAnomalies('', { 'sessionMetadata.sessionId': params.sessionId });
    const transformedAnomalies = this.transformationService.transformAnomalies(anomalies);
    
    return {
      success: true,
      data: transformedAnomalies,
    };
  }

  @OpenAPI({
    summary: 'Get exam anomalies',
    description: 'Retrieves all anomalies for a specific exam',
  })
  @Get('/exam/:examId')
  @Authorized()
  @ResponseSchema(AnomalyDataResponse)
  async getExamAnomalies(@Params() params: ExamIdParams): Promise<{
    success: boolean;
    data: any[];
  }> {
    const anomalies = await this.anomalyService.getUserAnomalies('', { 'sessionMetadata.examId': params.examId });
    const transformedAnomalies = this.transformationService.transformAnomalies(anomalies);
    
    return {
      success: true,
      data: transformedAnomalies,
    };
  }

  @OpenAPI({
    summary: 'Get course anomalies',
    description: 'Retrieves all anomalies for a specific course',
  })
  @Get('/course/:courseId')
  @Authorized()
  @ResponseSchema(AnomalyDataResponse)
  async getCourseAnomalies(@Params() params: CourseIdParams): Promise<{
    success: boolean;
    data: any[];
  }> {
    const anomalies = await this.anomalyService.getCourseAnomalies(params.courseId);
    const transformedAnomalies = this.transformationService.transformAnomalies(anomalies);
    
    return {
      success: true,
      data: transformedAnomalies,
    };
  }

  @OpenAPI({
    summary: 'Get anomaly statistics',
    description: 'Retrieves anomaly statistics for a user',
  })
  @Get('/stats/:userId')
  @Authorized()
  @ResponseSchema(AnomalyStatsResponse)
  async getAnomalyStats(@Params() params: UserIdParams): Promise<{
    success: boolean;
    data: any;
  }> {
    const stats = await this.anomalyService.getAnomalyStats(params.userId);
    
    return {
      success: true,
      data: stats,
    };
  }

  @OpenAPI({
    summary: 'Delete anomaly',
    description: 'Deletes an anomaly record and its encrypted image',
  })
  @Delete('/:id')
  @Authorized(['admin', 'instructor'])
  async deleteAnomaly(
    @Params() params: AnomalyIdParams,
    @Header('authorization', 'authorization') authorization?: string
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    // Could log authorization header for audit purposes (without exposing the token)
    // Example: Log that deletion was requested with valid auth header
    
    const deleted = await this.anomalyService.deleteAnomaly(params.id);
    
    return {
      success: deleted,
      message: deleted ? 'Anomaly and encrypted image deleted successfully' : 'Anomaly not found',
    };
  }
}