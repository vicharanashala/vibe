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
import { instanceToPlain } from 'class-transformer';
import { AnomalyService } from '../services/AnomalyService.js';
import { ImageProcessingService } from '../services/ImageProcessingService.js';
import { Anomaly } from '../classes/transformers/Anomaly.js';
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
  private readonly TEST_COURSE_ID = "507f1f77bcf86cd799439012"; // Test course ID for debugging endpoints

  constructor(
    @inject(ANOMALIES_TYPES.AnomalyService) private anomalyService: AnomalyService,
    @inject(ANOMALIES_TYPES.ImageProcessingService) private imageProcessingService: ImageProcessingService
  ) {}

  /**
   * Transform a single anomaly using class-transformer
   */
  private transformAnomaly(anomaly: any): any {
    const anomalyInstance = new Anomaly(anomaly);
    return instanceToPlain(anomalyInstance);
  }

  /**
   * Transform an array of anomalies using class-transformer
   */
  private transformAnomalies(anomalies: any[]): any[] {
    return anomalies.map(anomaly => this.transformAnomaly(anomaly));
  }

  /**
   * Utility function to build filters from query parameters
   */
  private buildFiltersFromQuery(query: GetUserAnomaliesQuery): any {
    const filters: any = {};
    
    // Simple field mappings
    const fieldMappings = [
      'courseVersionId', 'courseId', 'moduleId', 
      'sectionId', 'itemId', 'anomalyType'
    ];
    
    fieldMappings.forEach(field => {
      if (query[field as keyof GetUserAnomaliesQuery]) {
        filters[field] = query[field as keyof GetUserAnomaliesQuery];
      }
    });
    
    // Handle date range filters
    if (query.anomaliesFrom || query.anomaliesTo) {
      filters.timestamp = {};
      if (query.anomaliesFrom) filters.timestamp.$gte = new Date(query.anomaliesFrom);
      if (query.anomaliesTo) filters.timestamp.$lte = new Date(query.anomaliesTo);
    }
    
    return filters;
  }

  /**
   * Utility function to prepare multipart anomaly data
   */
  private prepareAnomalyData(file: any, body: MultipartAnomalyData): any {
    const imageDataBase64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    const anomalyData = JSON.parse(body.data);
    
    return {
      ...anomalyData,
      imageData: imageDataBase64
    };
  }

  /**
   * Utility function to build response endpoints
   */
  private buildResponseEndpoints(hexId: string): { decrypt: string; viewImage: string; latest: string } {
    return {
      decrypt: `/api/anomalies/test/decrypt/${hexId}`,
      viewImage: `/api/anomalies/test/view-image/${hexId}`,
      latest: `/api/anomalies/test/latest`
    };
  }

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
    // Prepare anomaly data using utility function
    const completeAnomalyData = this.prepareAnomalyData(file, body);
    
    // Add user agent information if available
    if (userAgent) {
      completeAnomalyData.sessionMetadata = {
        ...completeAnomalyData.sessionMetadata,
        userAgent: userAgent
      };
    }
    
    const result = await this.anomalyService.recordAnomaly(completeAnomalyData);
    
    // Convert ObjectId to hex string for easy use with other endpoints
    const hexId = result._id?.toString() || 'unknown';
    
    // Transform using class-transformer for proper ObjectId to string conversion
    const transformedResult = this.transformAnomaly(result);
    
    return {
      success: true,
      hexId: hexId, // Direct hex ID for use with other endpoints
      message: 'Anomaly recorded successfully with compressed & encrypted image',
      endpoints: this.buildResponseEndpoints(hexId),
      data: transformedResult
    };
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
    // Build filters using utility function
    const filters = this.buildFiltersFromQuery(query);

    const anomalies = await this.anomalyService.getUserAnomalies(params.userId, filters);
    
    // Transform array using class-transformer
    const transformedAnomalies = this.transformAnomalies(anomalies);
    
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
    
    const transformedAnomalies = this.transformAnomalies(anomalies);
    
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
    
    const transformedAnomalies = this.transformAnomalies(anomalies);
    
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
    
    const transformedAnomalies = this.transformAnomalies(anomalies);
    
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

  @OpenAPI({
    summary: 'Get all anomalies for a course (for testing)',
    description: 'Retrieves all anomalies for a specific course - useful for testing and debugging',
  })
  @Get('/test/course/:courseId')
  @ResponseSchema(AnomalyDataResponse)
  async getTestCourseAnomalies(@Params() params: CourseIdParams): Promise<{
    success: boolean;
    data: any[];
  }> {
    const anomalies = await this.anomalyService.getCourseAnomalies(params.courseId);
    
    const transformedAnomalies = this.transformAnomalies(anomalies);
    
    return {
      success: true,
      data: transformedAnomalies,
    };
  }

  @OpenAPI({
    summary: 'Get latest anomaly (for testing with readable IDs)',
    description: 'Retrieves the latest anomaly with human-readable ObjectIds for testing',
  })
  @Get('/test/latest')
  async getLatestAnomaly(): Promise<{
    success: boolean;
    data: any;
    readable: any;
  }> {
    const anomalies = await this.anomalyService.getCourseAnomalies(this.TEST_COURSE_ID);
    const latest = anomalies[0];
    
    if (!latest) {
      return {
        success: false,
        data: null,
        readable: null
      };
    }
    
    // Use class-transformer to transform ObjectIds to readable strings
    const readable = this.transformAnomaly(latest);
    
    return {
      success: true,
      data: latest,
      readable: readable
    };
  }

  @OpenAPI({
    summary: 'Decrypt anomaly data (for testing)',
    description: 'Returns decrypted image data and metadata for testing purposes. Note: This endpoint is for development/testing only.',
  })
  @Get('/test/decrypt/:id')
  async decryptTestAnomaly(@Params() params: AnomalyIdParams): Promise<{
    success: boolean;
    message?: string;
    data?: {
      id: string;
      decryptedImageBase64?: string;
      metadata: any;
      encryptionInfo: {
        hasEncryptedData: boolean;
        ivFormat: string;
        bufferSize?: number;
      };
    };
  }> {
    // Find anomaly
    const anomaly = await this.findAnomalyById(params.id);
    if (!anomaly) {
      return {
        success: false,
        message: 'Anomaly not found'
      };
    }

    // Validate encrypted image data
    const encryptedDataValidation = this.validateEncryptedImageData(anomaly);
    if (!encryptedDataValidation.isValid) {
      return {
        success: false,
        message: encryptedDataValidation.error
      };
    }

    // Validate IV
    const ivValidation = this.validateIV(encryptedDataValidation.data!.iv);
    if (!ivValidation.isValid) {
      return {
        success: false,
        message: ivValidation.error
      };
    }

    // Prepare decryption parameters
    const { encryptedBuffer: bufferData, iv, authTag = '' } = encryptedDataValidation.data!;
    const encryptedBuffer = Buffer.from(bufferData.data);

    // Decrypt the image
    const decryptedBuffer = this.imageProcessingService.decryptImage(encryptedBuffer, iv, authTag);
    
    // Convert to base64 for JSON response
    const decryptedImageBase64 = `data:image/jpeg;base64,${decryptedBuffer.toString('base64')}`;

    // Transform anomaly metadata
    const transformedAnomaly = this.transformAnomaly(anomaly);

    return {
      success: true,
      data: {
        id: params.id,
        decryptedImageBase64,
        metadata: transformedAnomaly,
        encryptionInfo: {
          hasEncryptedData: true,
          ivFormat: typeof iv,
          bufferSize: encryptedBuffer.length
        }
      }
    };
  }

  /**
   * Utility function to find anomaly by ID
   */
  private async findAnomalyById(id: string): Promise<any | null> {
    const anomalies = await this.anomalyService.getCourseAnomalies(this.TEST_COURSE_ID);
    return anomalies.find(a => a._id?.toString() === id) || null;
  }

  /**
   * Utility function to validate encrypted image data structure
   */
  private validateEncryptedImageData(anomaly: any): { isValid: boolean; error?: string; data?: any } {
    if (!anomaly.encryptedImageData || typeof anomaly.encryptedImageData !== 'object') {
      return {
        isValid: false,
        error: 'No encrypted image data found. Use the imageUrl to download the encrypted file from cloud storage'
      };
    }

    const encryptedData = anomaly.encryptedImageData as any;
    if (!encryptedData.encryptedBuffer || !encryptedData.iv) {
      return {
        isValid: false,
        error: 'Invalid encrypted image data structure'
      };
    }

    return { isValid: true, data: encryptedData };
  }

  /**
   * Utility function to validate IV format
   */
  private validateIV(iv: any): { isValid: boolean; error?: string } {
    if (!iv || typeof iv !== 'string') {
      return {
        isValid: false,
        error: `Invalid IV - must be a hex string. Received: ${iv} (${typeof iv})`
      };
    }
    return { isValid: true };
  }

  /**
   * Utility function to set image response headers
   */
  private setImageResponseHeaders(response: Response, contentLength: number, filename: string, accept?: string): void {
    // Determine content type based on Accept header or default to JPEG
    let contentType = 'image/jpeg';
    if (accept) {
      if (accept.includes('image/png')) {
        contentType = 'image/png';
      } else if (accept.includes('image/webp')) {
        contentType = 'image/webp';
      }
      // Default to JPEG if no specific image type is requested
    }
    
    response.setHeader('Content-Type', contentType);
    response.setHeader('Content-Length', contentLength);
    response.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  }

  @OpenAPI({
    summary: 'Get decrypted image (for testing)',
    description: 'Returns the actual decrypted image file for viewing. This endpoint decrypts the image and serves it directly. Supports content negotiation via Accept header.',
    responses: {
      200: {
        description: 'Decrypted image file',
        content: {
          'image/jpeg': {
            schema: {
              type: 'string',
              format: 'binary'
            }
          },
          'image/png': {
            schema: {
              type: 'string',
              format: 'binary'
            }
          }
        }
      }
    }
  })
  @Get('/test/view-image/:id')
  async viewDecryptedImage(
    @Params() params: AnomalyIdParams, 
    @Res() response: Response,
    @Header('accept', 'accept') accept?: string
  ): Promise<any> {
    // Find anomaly
    const anomaly = await this.findAnomalyById(params.id);
    if (!anomaly) {
      return response.status(404).json({ success: false, message: 'Anomaly not found' });
    }

    // Validate encrypted image data
    const encryptedDataValidation = this.validateEncryptedImageData(anomaly);
    if (!encryptedDataValidation.isValid) {
      return response.status(400).json({ success: false, message: encryptedDataValidation.error });
    }

    // Validate IV
    const ivValidation = this.validateIV(encryptedDataValidation.data!.iv);
    if (!ivValidation.isValid) {
      return response.status(400).json({ success: false, message: ivValidation.error });
    }

    // Prepare decryption parameters
    const { encryptedBuffer: bufferData, iv, authTag = '' } = encryptedDataValidation.data!;
    const encryptedBuffer = Buffer.from(bufferData.data);

    // Decrypt the image
    const decryptedBuffer = this.imageProcessingService.decryptImage(encryptedBuffer, iv, authTag);

    // Set response headers and send image
    this.setImageResponseHeaders(response, decryptedBuffer.length, `anomaly-${params.id}.jpg`, accept);
    return response.send(decryptedBuffer);
  }
}