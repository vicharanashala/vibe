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
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { AnomalyService } from '../services/AnomalyService.js';
import { BadRequestErrorResponse } from '#shared/middleware/errorHandler.js';
import { ANOMALIES_TYPES } from '../types.js';
import { audioUploadOptions, imageUploadOptions } from '../classes/validators/fileUploadOptions.js';
import { AnomalyData, AnomalyIdParams, DeleteAnomalyBody, GetCourseAnomalyParams, GetUserAnomalyParams, NewAnomalyData } from '../classes/validators/AnomalyValidators.js';
import { FileType } from '../classes/transformers/Anomaly.js';

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
    summary: 'Record anomaly with encrypted image',
    description: 'Records an anomaly with compressed and encrypted image stored in cloud storage. Captures User-Agent header for session metadata.',
  })
  @Post('/record/image')
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
    @UploadedFile("image", { required: true, options: () => imageUploadOptions })
      file: Express.Multer.File,
    @Body() body: NewAnomalyData,
  ): Promise<AnomalyData> {
    const { courseId, versionId } = body;
    return this.anomalyService.recordAnomaly(userId, body, file, FileType.IMAGE);
  }

  @OpenAPI({
    summary: 'Record anomaly with encrypted audio',
    description: 'Records an anomaly with compressed and encrypted audio stored in cloud storage. Captures User-Agent header for session metadata.',
  })
  @Post('/record/audio')
  @HttpCode(201)
  @Authorized()
  @ResponseSchema(AnomalyData, {
    description: 'Anomaly recorded successfully',
  })
  @ResponseSchema(BadRequestErrorResponse, {
    description: 'Bad Request Error',
    statusCode: 400,
  })
  async recordAudioAnomaly(
    @UploadedFile("audio", { required: true, options: () => audioUploadOptions })
      file: Express.Multer.File,
    @Body() body: NewAnomalyData,
  ): Promise<AnomalyData> {
    const { courseId, versionId } = body;
    return this.anomalyService.recordAnomaly(userId, body, file, FileType.AUDIO);
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
  ): Promise<AnomalyData[]> {
    const { courseId, versionId, userId } = params;
    const anomalies = await this.anomalyService.getUserAnomalies(userId, courseId, versionId);

    return anomalies;
  }

  @OpenAPI({
    summary: 'Get course anomalies',
    description: 'Retrieves all anomalies for a specific course',
  })
  @Get('/course/:courseId/version/:versionId')
  @Authorized()
  @ResponseSchema(AnomalyData)
  async getCourseAnomalies(@Params() params: GetCourseAnomalyParams): Promise<AnomalyData[]> {
    const { courseId, versionId } = params;
    const anomalies = await this.anomalyService.getCourseAnomalies(courseId, versionId);

    return anomalies;
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
  ): Promise<void> {
    const { courseId, versionId } = body;

    await this.anomalyService.deleteAnomaly(params.id, courseId, versionId);
  }
}