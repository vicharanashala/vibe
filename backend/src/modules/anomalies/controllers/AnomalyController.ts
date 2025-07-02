import { injectable, inject } from 'inversify';
import {
  JsonController,
  Authorized,
  Post,
  Get,
  Delete,
  Body,
  Param,
  QueryParam,
  HttpCode,
  UploadedFile,
  Res,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Response } from 'express';
import { AnomalyService } from '../services/AnomalyService.js';
import { ImageProcessingService } from '../services/ImageProcessingService.js';
import { CloudStorageService } from '../services/CloudStorageService.js';
import { 
  CreateAnomalyBody, 
  AnomalyIdParams, 
  UserIdParams,
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
    @inject(ANOMALIES_TYPES.ImageProcessingService) private imageProcessingService: ImageProcessingService,
    @inject(ANOMALIES_TYPES.CloudStorageService) private cloudStorageService: CloudStorageService
  ) {}

  @OpenAPI({
    summary: 'Record anomaly with encrypted image',
    description: 'Records an anomaly with compressed and encrypted image stored in cloud storage',
    requestBody: {
      required: true,
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
            required: ['image', 'data'],
            properties: {
              image: {
                type: 'string',
                format: 'binary',
                description: 'Image file to upload'
              },
              data: {
                type: 'string',
                description: 'JSON string containing all anomaly data',
                example: JSON.stringify({
                  userId: "507f1f77bcf86cd799439011",
                  courseId: "507f1f77bcf86cd799439012",
                  courseVersionId: "507f1f77bcf86cd799439016",
                  moduleId: "507f1f77bcf86cd799439013",
                  sectionId: "507f1f77bcf86cd799439014",
                  itemId: "507f1f77bcf86cd799439015",
                  anomalyType: "voiceDetection",
                  penaltyPoints: 5,
                  facesDetected: 1,
                  sessionMetadata: {
                    browserInfo: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                  }
                })
              }
            }
          }
        }
      }
    }
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
    @Body() body: { data: string }
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
      data: this.transformAnomalyData(result)
    };
  }

  private transformAnomalyData(data: any): any {
    if (Array.isArray(data)) {
      return data.map(item => this.transformAnomalyData(item));
    }
  
    if (data && typeof data === 'object' && data !== null) {
      // Handle BSON ObjectId which might not be a direct instance of ObjectId
      if (data._bsontype === 'ObjectId') {
        return data.toString();
      }
  
      // Create a new object to avoid modifying the original
      const newObj: { [key: string]: any } = {};
  
      for (const key of Object.keys(data)) {
        if (key === 'encryptedImageData' || key === 'encryptedBuffer') {
          // Skip bulky fields
          continue;
        }
  
        // Convert any potential ObjectId-like objects to strings
        if (data[key] && typeof data[key] === 'object' && data[key]._bsontype === 'ObjectId') {
          newObj[key] = data[key].toString();
        } else if (data[key] && typeof data[key] === 'object' && data[key].buffer && data[key].buffer.type === 'Buffer') {
          // This handles the nested buffer structure for IDs
          // We assume if it has this structure, it's an ID that should be converted.
          // The actual conversion to a hex string from this buffer structure is complex
          // and often handled by the MongoDB driver's serialization.
          // A simple and safe transformation is to just provide the string version if available.
          // Here, we rely on the fact that the service layer might have already attached the string version
          // or we just skip it if it's too complex to parse reliably.
          newObj[key] = this.transformAnomalyData(data[key]);
        } else if (key !== '_id' && data[key] && data[key].id && typeof data[key].id === 'object') {
          // Another pattern for ObjectIDs
          newObj[key] = data[key].id.toString();
        }
        else {
          newObj[key] = this.transformAnomalyData(data[key]);
        }
      }
      
      // After building the new object, ensure the root _id is a string
      if (newObj._id && typeof newObj._id === 'object') {
        newObj._id = newObj._id.toString();
      }
  
      return newObj;
    }
  
    return data;
  }

  @OpenAPI({
    summary: 'Get user anomalies with optional filtering',
    description: 'Retrieves anomalies for a specific user with optional filtering by course, module, section, item, type, and date range. Results are sorted by most recent first.',
    parameters: [
      {
        name: 'userId',
        in: 'path',
        required: true,
        description: 'User ID to get anomalies for',
        schema: { type: 'string' }
      },
      {
        name: 'courseVersionId',
        in: 'query',
        required: false,
        description: 'Filter by course version ID',
        schema: { type: 'string' }
      },
      {
        name: 'courseId',
        in: 'query',
        required: false,
        description: 'Filter by course ID',
        schema: { type: 'string' }
      },
      {
        name: 'moduleId',
        in: 'query',
        required: false,
        description: 'Filter by module ID',
        schema: { type: 'string' }
      },
      {
        name: 'sectionId',
        in: 'query',
        required: false,
        description: 'Filter by section ID',
        schema: { type: 'string' }
      },
      {
        name: 'itemId',
        in: 'query',
        required: false,
        description: 'Filter by item ID',
        schema: { type: 'string' }
      },
      {
        name: 'anomalyType',
        in: 'query',
        required: false,
        description: 'Filter by anomaly type (e.g., voiceDetection, faceDetection)',
        schema: { type: 'string' }
      },
      {
        name: 'anomaliesFrom',
        in: 'query',
        required: false,
        description: 'Filter anomalies from this date (ISO 8601 format)',
        schema: { type: 'string', format: 'date-time' }
      },
      {
        name: 'anomaliesTo',
        in: 'query',
        required: false,
        description: 'Filter anomalies to this date (ISO 8601 format)',
        schema: { type: 'string', format: 'date-time' }
      }
    ]
  })
  @Get('/user/:userId')
  @Authorized()
  @ResponseSchema(AnomalyDataResponse)
  async getUserAnomalies(
    @Param('userId') userId: string,
    @QueryParam('courseVersionId') courseVersionId?: string,
    @QueryParam('courseId') courseId?: string,
    @QueryParam('moduleId') moduleId?: string,
    @QueryParam('sectionId') sectionId?: string,
    @QueryParam('itemId') itemId?: string,
    @QueryParam('anomalyType') anomalyType?: string,
    @QueryParam('anomaliesFrom') anomaliesFrom?: string,
    @QueryParam('anomaliesTo') anomaliesTo?: string
  ): Promise<{
    success: boolean;
    data: any[];
    filters?: any;
  }> {
    // Build filter object to be passed to the service
    const filters: any = {};
    
    if (courseVersionId) filters.courseVersionId = courseVersionId;
    if (courseId) filters.courseId = courseId;
    if (moduleId) filters.moduleId = moduleId;
    if (sectionId) filters.sectionId = sectionId;
    if (itemId) filters.itemId = itemId;
    if (anomalyType) filters.anomalyType = anomalyType;
    
    // Handle date range filtering
    if (anomaliesFrom || anomaliesTo) {
      filters.timestamp = {};
      if (anomaliesFrom) {
        filters.timestamp.$gte = new Date(anomaliesFrom);
      }
      if (anomaliesTo) {
        filters.timestamp.$lte = new Date(anomaliesTo);
      }
    }
    
    // Pass the filters to the service
    const anomalies = await this.anomalyService.getUserAnomalies(userId, filters);
    
    // The database has already filtered, so we just sort the results
    const sortedAnomalies = anomalies.sort((a: any, b: any) => {
      const timeA = new Date(a.timestamp || a.createdAt).getTime();
      const timeB = new Date(b.timestamp || b.createdAt).getTime();
      return timeB - timeA; // Descending order (most recent first)
    });
    
    return {
      success: true,
      data: this.transformAnomalyData(sortedAnomalies),
      filters: Object.keys(filters).length > 0 ? filters : undefined
    };
  }

  @OpenAPI({
    summary: 'Get course anomalies',
    description: 'Retrieves all anomalies for a specific course',
  })
  @Get('/course/:courseId')
  @Authorized()
  @ResponseSchema(AnomalyDataResponse)
  async getCourseAnomalies(@Param('courseId') courseId: string): Promise<{
    success: boolean;
    data: any[];
  }> {
    const anomalies = await this.anomalyService.getCourseAnomalies(courseId);
    
    return {
      success: true,
      data: this.transformAnomalyData(anomalies),
    };
  }

  @OpenAPI({
    summary: 'Get anomaly statistics',
    description: 'Retrieves anomaly statistics for a user',
  })
  @Get('/stats/:userId')
  @Authorized()
  @ResponseSchema(AnomalyStatsResponse)
  async getAnomalyStats(@Param('userId') userId: string): Promise<{
    success: boolean;
    data: any;
  }> {
    const stats = await this.anomalyService.getAnomalyStats(userId);
    
    return {
      success: true,
      data: this.transformAnomalyData(stats),
    };
  }

  @OpenAPI({
    summary: 'Delete anomaly',
    description: 'Deletes an anomaly record and its encrypted image',
  })
  @Delete('/:id')
  @Authorized(['admin', 'instructor'])
  async deleteAnomaly(@Param('id') id: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const deleted = await this.anomalyService.deleteAnomaly(id);
    
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
  async getTestCourseAnomalies(@Param('courseId') courseId: string): Promise<{
    success: boolean;
    data: any[];
  }> {
    const anomalies = await this.anomalyService.getCourseAnomalies(courseId);
    
    return {
      success: true,
      data: this.transformAnomalyData(anomalies),
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
      data: this.transformAnomalyData(latest),
      readable: readable
    };
  }

  @OpenAPI({
    summary: 'Decrypt and view anomaly image (for testing)',
    description: 'Decrypts an anomaly image and returns a base64 data URL for direct viewing. Tries local encrypted data first, then falls back to downloading from cloud storage. Use the _id from your anomaly record (24-character hex string like: 6862654bb11cf85018dd7903)',
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        description: 'MongoDB ObjectId of the anomaly (24-character hex string). Get this from the _id field of your anomaly record. Example: 6862654bb11cf85018dd7903',
        schema: {
          type: 'string',
          pattern: '^[0-9a-fA-F]{24}$',
          example: '6862654bb11cf85018dd7903'
        }
      }
    ]
  })
  @Get('/test/decrypt/:id')
  async decryptAnomalyImage(@Param('id') id: string): Promise<any> {
    try {
      // Get the anomaly record
      const anomaly = await this.anomalyService.findAnomalyById(id);
      
      if (!anomaly) {
        return { success: false, message: 'Anomaly not found' };
      }

      let decryptedBuffer: Buffer | null = null;
      let decryptionMethod = '';

      // Try Method 1: Use locally stored encrypted data if available
      if (anomaly.encryptedImageData && typeof anomaly.encryptedImageData === 'object') {
        try {
          const encryptedData = anomaly.encryptedImageData as any;
          console.log('🔍 Local encrypted data structure:', {
            hasEncryptedBuffer: !!encryptedData.encryptedBuffer,
            encryptedBufferType: typeof encryptedData.encryptedBuffer,
            encryptedBufferKeys: encryptedData.encryptedBuffer ? Object.keys(encryptedData.encryptedBuffer) : null,
            hasBufferData: !!(encryptedData.encryptedBuffer && encryptedData.encryptedBuffer.data),
            bufferDataLength: encryptedData.encryptedBuffer?.data?.length,
            isBufferArray: Array.isArray(encryptedData.encryptedBuffer),
            bufferArrayLength: Array.isArray(encryptedData.encryptedBuffer) ? encryptedData.encryptedBuffer.length : null,
            hasIv: !!encryptedData.iv,
            ivValue: encryptedData.iv,
            hasAuthTag: !!encryptedData.authTag,
            algorithm: encryptedData.algorithm
          });

          if (encryptedData.encryptedBuffer && encryptedData.iv) {
            // Handle different buffer formats
            let bufferData;
            
            console.log('🔬 Inspecting encryptedBuffer structure:', JSON.stringify(encryptedData.encryptedBuffer, null, 2));

            if (encryptedData.encryptedBuffer.buffer && Buffer.isBuffer(encryptedData.encryptedBuffer.buffer)) {
              // BSON Binary format from MongoDB driver, e.g., { buffer: <Buffer ...>, sub_type: 0, position: ... }
              bufferData = encryptedData.encryptedBuffer.buffer;
              console.log('📦 Using BSON Binary buffer format');
            } else if (encryptedData.encryptedBuffer.data) {
              // MongoDB stores Buffer as { type: 'Buffer', data: [...] }
              bufferData = encryptedData.encryptedBuffer.data;
              console.log('📦 Using buffer.data format');
            } else if (Array.isArray(encryptedData.encryptedBuffer)) {
              // Direct array format
              bufferData = encryptedData.encryptedBuffer;
              console.log('📦 Using direct array format');
            } else if (Buffer.isBuffer(encryptedData.encryptedBuffer)) {
              // Already a Buffer
              bufferData = encryptedData.encryptedBuffer;
              console.log('📦 Already a Buffer format');
            } else if (typeof encryptedData.encryptedBuffer === 'object' && encryptedData.encryptedBuffer.type === 'Buffer') {
              // MongoDB format without .data wrapper
              bufferData = Object.values(encryptedData.encryptedBuffer).filter(v => Array.isArray(v))[0];
              console.log('📦 Using MongoDB Buffer format without .data wrapper');
            } else {
              throw new Error(`Unsupported encrypted buffer format: ${typeof encryptedData.encryptedBuffer}, isArray: ${Array.isArray(encryptedData.encryptedBuffer)}, keys: ${Object.keys(encryptedData.encryptedBuffer)}`);
            }

            const encryptedBuffer = Buffer.isBuffer(bufferData) ? bufferData : Buffer.from(bufferData);
            const iv = encryptedData.iv;
            const authTag = encryptedData.authTag || '';

            console.log('🔐 Attempting local decryption with:', {
              encryptedBufferSize: encryptedBuffer.length,
              ivLength: iv.length,
              authTag: authTag
            });

            decryptedBuffer = this.imageProcessingService.decryptBuffer(encryptedBuffer, iv, authTag);
            decryptionMethod = 'local_encrypted_data';
            console.log('✅ Successfully decrypted using local encrypted data');
          } else {
            console.warn('⚠️ Missing required fields for local decryption');
          }
        } catch (localDecryptError) {
          console.warn('⚠️ Local decryption failed, trying cloud storage:', localDecryptError.message);
        }
      }

      // Try Method 2: Download and decrypt from cloud storage
      if (!decryptedBuffer && anomaly.imageUrl) {
        try {
          // Parse the Google Cloud Storage signed URL
          const url = new URL(anomaly.imageUrl);
          console.log('🔍 Parsing URL:', {
            host: url.host,
            pathname: url.pathname,
            searchParams: Object.fromEntries(url.searchParams)
          });

          let filePath = '';
          
          if (url.host === 'storage.googleapis.com') {
            // Handle different Google Cloud Storage URL formats
            if (url.pathname.startsWith('/storage/v1/b/')) {
              // REST API format: /storage/v1/b/bucket-name/o/path%2Fto%2Ffile
              const pathParts = url.pathname.split('/');
              const bucketIndex = pathParts.findIndex(part => part === 'o');
              if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
                const encodedPath = pathParts.slice(bucketIndex + 1).join('/');
                filePath = decodeURIComponent(encodedPath.split('?')[0]);
              }
            } else {
              // Simple format: /bucket-name/path/to/file
              const pathParts = url.pathname.split('/').filter(part => part.length > 0);
              if (pathParts.length > 1) {
                filePath = pathParts.slice(1).join('/').split('?')[0]; // Remove bucket name and query params
              }
            }
          } else if (url.host.includes('.googleapis.com')) {
            // Signed URL format: https://storage.googleapis.com/vibe-faces-storage/path/to/file?...
            const pathParts = url.pathname.split('/').filter(part => part.length > 0);
            if (pathParts.length > 1) {
              filePath = pathParts.slice(1).join('/').split('?')[0]; // Remove bucket name and query params
            }
          }

          if (!filePath) {
            throw new Error('Could not extract file path from URL');
          }

          console.log(`🌥️ Attempting to download and decrypt from cloud storage: ${filePath}`);
          decryptedBuffer = await this.cloudStorageService.downloadAndDecryptImage(filePath);
          decryptionMethod = 'cloud_storage_download';
          console.log('✅ Successfully decrypted using cloud storage download');
        } catch (cloudDecryptError) {
          console.warn('⚠️ Cloud storage decryption failed:', cloudDecryptError.message);
          console.warn('⚠️ Cloud storage error details:', {
            error: cloudDecryptError.message,
            imageUrl: anomaly.imageUrl
          });
        }
      }

      // If we successfully decrypted the image
      if (decryptedBuffer) {
        // Convert decrypted buffer to base64 for viewing
        const base64Image = decryptedBuffer.toString('base64');
        const dataUrl = `data:image/jpeg;base64,${base64Image}`;

        return {
          success: true,
          message: `Image decrypted successfully via ${decryptionMethod}.`,
          data: {
            id: anomaly._id?.toString(),
            decryptedImageUrl: dataUrl, // This can be used directly in <img> tags
            viewImageUrl: `/api/anomalies/test/view-image/${id}`,
            decryptionMethod: decryptionMethod,
            
            // Associated anomaly data
            anomalyDetails: {
              userId: anomaly.userId?.toString(),
              courseId: anomaly.courseId?.toString(),
              anomalyType: anomaly.anomalyType,
              timestamp: anomaly.timestamp,
              penaltyPoints: anomaly.penaltyPoints,
              facesDetected: anomaly.facesDetected,
              sessionMetadata: anomaly.sessionMetadata,
              imageMetadata: anomaly.imageMetadata,
            }
          }
        };
      }

      // If all decryption methods failed
      return {
        success: false,
        message: 'Unable to decrypt image using any available method',
        data: {
          id: anomaly._id?.toString(),
          imageUrl: anomaly.imageUrl,
          imageMetadata: anomaly.imageMetadata,
          hasLocalEncryptedData: !!(anomaly.encryptedImageData && typeof anomaly.encryptedImageData === 'object'),
          hasCloudUrl: !!anomaly.imageUrl,
          troubleshooting: {
            localDataStructure: anomaly.encryptedImageData ? Object.keys(anomaly.encryptedImageData) : null,
            imageUrlStructure: anomaly.imageUrl ? 'Available' : 'Missing'
          }
        }
      };

    } catch (error) {
      console.error('Error in decrypt endpoint:', error);
      return { success: false, message: error.message };
    }
  }

  @OpenAPI({
    summary: 'Get decrypted image (for testing)',
    description: 'Returns the actual decrypted image file for viewing. This endpoint decrypts the image and serves it directly.',
    parameters: [
      {
        name: 'id',
        in: 'path',
        required: true,
        description: 'MongoDB ObjectId of the anomaly (24-character hex string)',
        schema: {
          type: 'string',
          pattern: '^[0-9a-fA-F]{24}$',
          example: '6862634e9d0f8ef7173d77f1'
        }
      }
    ],
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
  async viewDecryptedImage(@Param('id') id: string, @Res() response: Response): Promise<any> {
    try {
      // Get the anomaly record
      const anomaly = await this.anomalyService.findAnomalyById(id);
      
      if (!anomaly) {
        return response.status(404).json({ success: false, message: 'Anomaly not found' });
      }

      let decryptedBuffer: Buffer | null = null;

      // Try Method 1: Use locally stored encrypted data if available
      if (anomaly.encryptedImageData && typeof anomaly.encryptedImageData === 'object') {
        try {
          const encryptedData = anomaly.encryptedImageData as any;
          if (encryptedData.encryptedBuffer && encryptedData.iv) {
            // Handle different buffer formats
            let bufferData;

            if (encryptedData.encryptedBuffer.buffer && Buffer.isBuffer(encryptedData.encryptedBuffer.buffer)) {
              // BSON Binary format from MongoDB driver
              bufferData = encryptedData.encryptedBuffer.buffer;
            } else if (encryptedData.encryptedBuffer.data) {
              // MongoDB stores Buffer as { type: 'Buffer', data: [...] }
              bufferData = encryptedData.encryptedBuffer.data;
            } else if (Array.isArray(encryptedData.encryptedBuffer)) {
              // Direct array format
              bufferData = encryptedData.encryptedBuffer;
            } else {
              throw new Error('Invalid encrypted buffer format');
            }

            const encryptedBuffer = Buffer.from(bufferData);
            const iv = encryptedData.iv;
            const authTag = encryptedData.authTag || '';

            decryptedBuffer = this.imageProcessingService.decryptBuffer(encryptedBuffer, iv, authTag);
            console.log('✅ Successfully decrypted using local encrypted data');
          }
        } catch (localDecryptError) {
          console.warn('⚠️ Local decryption failed, trying cloud storage:', localDecryptError.message);
        }
      }

      // Try Method 2: Download and decrypt from cloud storage
      if (!decryptedBuffer && anomaly.imageUrl) {
        try {
          // Parse the Google Cloud Storage signed URL
          const url = new URL(anomaly.imageUrl);
          let filePath = '';
          
          if (url.host === 'storage.googleapis.com') {
            // Handle different Google Cloud Storage URL formats
            if (url.pathname.startsWith('/storage/v1/b/')) {
              // REST API format: /storage/v1/b/bucket-name/o/path%2Fto%2Ffile
              const pathParts = url.pathname.split('/');
              const bucketIndex = pathParts.findIndex(part => part === 'o');
              if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
                const encodedPath = pathParts.slice(bucketIndex + 1).join('/');
                filePath = decodeURIComponent(encodedPath.split('?')[0]);
              }
            } else {
              // Simple format: /bucket-name/path/to/file
              const pathParts = url.pathname.split('/').filter(part => part.length > 0);
              if (pathParts.length > 1) {
                filePath = pathParts.slice(1).join('/').split('?')[0]; // Remove bucket name and query params
              }
            }
          } else if (url.host.includes('.googleapis.com')) {
            // Signed URL format: https://storage.googleapis.com/vibe-faces-storage/path/to/file?...
            const pathParts = url.pathname.split('/').filter(part => part.length > 0);
            if (pathParts.length > 1) {
              filePath = pathParts.slice(1).join('/').split('?')[0]; // Remove bucket name and query params
            }
          }

          if (!filePath) {
            throw new Error('Could not extract file path from URL');
          }

          console.log(`🌥️ Attempting to download and decrypt from cloud storage: ${filePath}`);
          decryptedBuffer = await this.cloudStorageService.downloadAndDecryptImage(filePath);
          console.log('✅ Successfully decrypted using cloud storage download');
        } catch (cloudDecryptError) {
          console.warn('⚠️ Cloud storage decryption failed:', cloudDecryptError.message);
        }
      }

      // If we successfully decrypted the image
      if (decryptedBuffer) {
        // Set appropriate headers for image response
        response.setHeader('Content-Type', 'image/jpeg'); // Assuming JPEG, could be dynamic
        response.setHeader('Content-Length', decryptedBuffer.length);
        response.setHeader('Content-Disposition', `inline; filename="anomaly-${id}.jpg"`);
        response.setHeader('Cache-Control', 'no-cache'); // Don't cache decrypted images

        // Send the decrypted image
        return response.send(decryptedBuffer);
      }

      // If all decryption methods failed
      return response.status(400).json({
        success: false,
        message: 'Unable to decrypt image using any available method',
        troubleshooting: {
          hasLocalEncryptedData: !!(anomaly.encryptedImageData && typeof anomaly.encryptedImageData === 'object'),
          hasCloudUrl: !!anomaly.imageUrl,
          imageUrl: anomaly.imageUrl
        }
      });

    } catch (error) {
      console.error('Error viewing decrypted image:', error);
      return response.status(500).json({ 
        success: false, 
        message: 'Failed to decrypt and serve image',
        error: error.message 
      });
    }
  }
}