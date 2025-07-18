import { injectable, inject } from 'inversify';
import { Response } from 'express';
import { AnomalyService } from './AnomalyService.js';
import { ImageProcessingService } from './ImageProcessingService.js';
import { AnomalyTransformationService } from './AnomalyTransformationService.js';
import { ANOMALIES_TYPES } from '../types.js';
import { IDecryptionResult } from '../classes/transformers/Anomaly.js';

@injectable()
export class AnomalyDecryptionService {
  constructor(
    @inject(ANOMALIES_TYPES.AnomalyService) private anomalyService: AnomalyService,
    @inject(ANOMALIES_TYPES.ImageProcessingService) private imageProcessingService: ImageProcessingService,
    @inject(ANOMALIES_TYPES.AnomalyTransformationService) private transformationService: AnomalyTransformationService
  ) {}

  /**
   * Set image response headers
   */
  setImageResponseHeaders(response: Response, contentLength: number, filename: string, accept?: string): void {
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

  /**
   * Decrypt anomaly data
   */
  async decryptAnomalyData(id: string): Promise<IDecryptionResult> {
    // Find anomaly
    const anomaly = await this.anomalyService.findAnomalyById(id);
    if (!anomaly) {
      return {
        success: false,
        message: 'Anomaly not found'
      };
    }

    // Validate encrypted image data
    const encryptedDataValidation = this.transformationService.validateEncryptedImageData(anomaly);
    if (!encryptedDataValidation.isValid) {
      return {
        success: false,
        message: encryptedDataValidation.error
      };
    }

    // Validate IV
    const ivValidation = this.transformationService.validateIV(encryptedDataValidation.data!.iv);
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
    const transformedAnomaly = this.transformationService.transformAnomaly(anomaly);

    return {
      success: true,
      data: {
        id: id,
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
   * Get decrypted image buffer for viewing
   */
  async getDecryptedImageBuffer(id: string): Promise<{
    success: boolean;
    buffer?: Buffer;
    error?: string;
  }> {
    // Find anomaly
    const anomaly = await this.anomalyService.findAnomalyById(id);
    if (!anomaly) {
      return {
        success: false,
        error: 'Anomaly not found'
      };
    }

    // Validate encrypted image data
    const encryptedDataValidation = this.transformationService.validateEncryptedImageData(anomaly);
    if (!encryptedDataValidation.isValid) {
      return {
        success: false,
        error: encryptedDataValidation.error
      };
    }

    // Validate IV
    const ivValidation = this.transformationService.validateIV(encryptedDataValidation.data!.iv);
    if (!ivValidation.isValid) {
      return {
        success: false,
        error: ivValidation.error
      };
    }

    // Prepare decryption parameters
    const { encryptedBuffer: bufferData, iv, authTag = '' } = encryptedDataValidation.data!;
    const encryptedBuffer = Buffer.from(bufferData.data);

    // Decrypt the image
    const decryptedBuffer = this.imageProcessingService.decryptImage(encryptedBuffer, iv, authTag);

    return {
      success: true,
      buffer: decryptedBuffer
    };
  }
}
