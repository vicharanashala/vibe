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
  HttpCode,
  UploadedFile,
  Res,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Response } from 'express';
import { AnomalyService } from '../services/AnomalyService.js';
import { ImageProcessingService } from '../services/ImageProcessingService.js';
import { 
  CreateAnomalyBody, 
  AnomalyIdParams, 
  UserIdParams,
  CourseIdParams,
  SessionIdParams,
  ExamIdParams,
  MultipartAnomalyData,
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
    @inject(ANOMALIES_TYPES.ImageProcessingService) private imageProcessingService: ImageProcessingService
  ) {}

  @OpenAPI({
    summary: 'Record anomaly with encrypted image',
    description: 'Records an anomaly with compressed and encrypted image stored in cloud storage',
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
    @Body() body: MultipartAnomalyData
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
    // Convert file buffer to base64 for existing service
    const imageDataBase64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    
    // Parse the JSON data from the form
    let anomalyData;
    try {
      anomalyData = JSON.parse(body.data);
    } catch (error) {
      throw new Error('Invalid JSON format in data field');
    }
    
    // Combine file data with parsed JSON data
    const completeAnomalyData = {
      ...anomalyData,
      imageData: imageDataBase64
    };
    
    const result = await this.anomalyService.recordAnomaly(completeAnomalyData);
    
    // Convert ObjectId to hex string for easy use with other endpoints
    const hexId = result._id?.toString() || 'unknown';
    
    return {
      success: true,
      hexId: hexId, // Direct hex ID for use with other endpoints
      message: 'Anomaly recorded successfully with compressed & encrypted image',
      endpoints: {
        decrypt: `/api/anomalies/test/decrypt/${hexId}`,
        viewImage: `/api/anomalies/test/view-image/${hexId}`,
        latest: `/api/anomalies/test/latest`
      },
      data: result
    };
  }

  @OpenAPI({
    summary: 'Get user anomalies',
    description: 'Retrieves all anomalies for a specific user',
  })
  @Get('/user/:userId')
  @Authorized()
  @ResponseSchema(AnomalyDataResponse)
  async getUserAnomalies(@Params() params: UserIdParams): Promise<{
    success: boolean;
    data: any[];
  }> {
    const anomalies = await this.anomalyService.getUserAnomalies(params.userId, {});
    
    return {
      success: true,
      data: anomalies,
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
    
    return {
      success: true,
      data: anomalies,
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
    
    return {
      success: true,
      data: anomalies,
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
    
    return {
      success: true,
      data: anomalies,
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
  async deleteAnomaly(@Params() params: AnomalyIdParams): Promise<{
    success: boolean;
    message: string;
  }> {
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
    
    return {
      success: true,
      data: anomalies,
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
    const anomalies = await this.anomalyService.getCourseAnomalies("507f1f77bcf86cd799439012");
    const latest = anomalies[0];
    
    if (!latest) {
      return {
        success: false,
        data: null,
        readable: null
      };
    }
    
    // Convert ObjectIds to readable strings
    const readable = {
      _id: latest._id?.toString(),
      userId: latest.userId?.toString(),
      courseId: latest.courseId?.toString(),
      courseVersionId: latest.courseVersionId?.toString(),
      moduleId: latest.moduleId?.toString(),
      sectionId: latest.sectionId?.toString(),
      itemId: latest.itemId?.toString(),
      timestamp: latest.timestamp,
      anomalyType: latest.anomalyType,
      penaltyPoints: latest.penaltyPoints,
      imageUrl: latest.imageUrl,
      facesDetected: latest.facesDetected,
      sessionMetadata: latest.sessionMetadata,
      imageMetadata: latest.imageMetadata,
      createdAt: latest.createdAt,
      updatedAt: latest.updatedAt
    };
    
    return {
      success: true,
      data: latest,
      readable: readable
    };
  }

  @OpenAPI({
    summary: 'Decrypt and view anomaly image (for testing)',
    description: 'Decrypts an anomaly image and returns it for testing purposes. Use the _id from your anomaly record (24-character hex string like: 6862654bb11cf85018dd7903)',
  })
  @Get('/test/decrypt/:id')
  async decryptAnomalyImage(@Params() params: AnomalyIdParams): Promise<any> {
    try {
      // Get the anomaly record
      const anomalies = await this.anomalyService.getCourseAnomalies("507f1f77bcf86cd799439012");
      const anomaly = anomalies.find(a => a._id?.toString() === params.id);
      
      if (!anomaly) {
        return { success: false, message: 'Anomaly not found' };
      }

      // Return the image URL and metadata for manual verification
      return {
        success: true,
        data: {
          id: anomaly._id?.toString(),
          imageUrl: anomaly.imageUrl,
          imageMetadata: anomaly.imageMetadata,
          encryptionInfo: {
            algorithm: 'aes-256-cbc',
            note: 'Image is encrypted and stored securely. Check encryptedImageData for IV and algorithm details.'
          }
        }
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  @OpenAPI({
    summary: 'Get decrypted image (for testing)',
    description: 'Returns the actual decrypted image file for viewing. This endpoint decrypts the image and serves it directly.',
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
  async viewDecryptedImage(@Params() params: AnomalyIdParams, @Res() response: Response): Promise<any> {
    try {
      // Get the anomaly record
      const anomalies = await this.anomalyService.getCourseAnomalies("507f1f77bcf86cd799439012");
      const anomaly = anomalies.find(a => a._id?.toString() === params.id);
      
      if (!anomaly) {
        return response.status(404).json({ success: false, message: 'Anomaly not found' });
      }

      // Check if we have encrypted image data
      if (!anomaly.encryptedImageData || typeof anomaly.encryptedImageData !== 'object') {
        return response.status(400).json({ 
          success: false, 
          message: 'No encrypted image data found',
          hint: 'Use the imageUrl to download the encrypted file from cloud storage'
        });
      }

      // Extract encryption details
      const encryptedData = anomaly.encryptedImageData as any;
      if (!encryptedData.encryptedBuffer || !encryptedData.iv) {
        return response.status(400).json({ 
          success: false, 
          message: 'Invalid encrypted image data structure'
        });
      }

      // Debug: Check if ImageProcessingService is available
      if (!this.imageProcessingService) {
        return response.status(500).json({ 
          success: false, 
          message: 'ImageProcessingService not available',
          debug: 'Dependency injection failed'
        });
      }

      // Convert buffer data back to Buffer
      const encryptedBuffer = Buffer.from(encryptedData.encryptedBuffer.data);
      const iv = encryptedData.iv; // This should be a hex string
      const authTag = encryptedData.authTag || '';

      // Debug logging
      console.log('Encrypted data structure:', {
        hasEncryptedBuffer: !!encryptedData.encryptedBuffer,
        bufferSize: encryptedData.encryptedBuffer?.data?.length,
        iv: iv,
        ivType: typeof iv,
        authTag: authTag,
        algorithm: encryptedData.algorithm
      });

      // Validate IV is a hex string
      if (!iv || typeof iv !== 'string') {
        return response.status(400).json({ 
          success: false, 
          message: 'Invalid IV - must be a hex string',
          debug: { iv: iv, type: typeof iv }
        });
      }

      // Decrypt the image
      const decryptedBuffer = this.imageProcessingService.decryptBuffer(encryptedBuffer, iv, authTag);

      // Set appropriate headers for image response
      response.setHeader('Content-Type', 'image/jpeg'); // Assuming JPEG, could be dynamic
      response.setHeader('Content-Length', decryptedBuffer.length);
      response.setHeader('Content-Disposition', `inline; filename="anomaly-${params.id}.jpg"`);

      // Send the decrypted image
      return response.send(decryptedBuffer);

    } catch (error) {
      console.error('Error viewing decrypted image:', error);
      return response.status(500).json({ 
        success: false, 
        message: 'Failed to decrypt image',
        error: error.message 
      });
    }
  }
}