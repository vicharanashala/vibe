import { injectable } from 'inversify';
import { instanceToPlain } from 'class-transformer';
import { Anomaly, IValidationResult } from '../classes/transformers/Anomaly.js';
import { GetUserAnomaliesQuery, MultipartAnomalyData } from '../classes/validators/AnomalyValidators.js';

@injectable()
export class AnomalyTransformationService {

  /**
   * Transform a single anomaly using class-transformer
   */
  transformAnomaly(anomaly: any): any {
    const anomalyInstance = new Anomaly(anomaly);
    return instanceToPlain(anomalyInstance);
  }

  /**
   * Transform an array of anomalies using class-transformer
   */
  transformAnomalies(anomalies: any[]): any[] {
    return anomalies.map(anomaly => this.transformAnomaly(anomaly));
  }

  /**
   * Build filters from query parameters
   */
  buildFiltersFromQuery(query: GetUserAnomaliesQuery): any {
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
   * Prepare multipart anomaly data
   */
  prepareAnomalyData(file: any, body: MultipartAnomalyData): any {
    const imageDataBase64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    const anomalyData = JSON.parse(body.data);
    
    return {
      ...anomalyData,
      imageData: imageDataBase64
    };
  }

  /**
   * Build response endpoints
   */
  buildResponseEndpoints(hexId: string): { decrypt: string; viewImage: string; latest: string } {
    return {
      decrypt: `/api/anomalies/test/decrypt/${hexId}`,
      viewImage: `/api/anomalies/test/view-image/${hexId}`,
      latest: `/api/anomalies/test/latest`
    };
  }

  /**
   * Validate encrypted image data structure
   */
  validateEncryptedImageData(anomaly: any): IValidationResult {
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
   * Validate IV format
   */
  validateIV(iv: any): IValidationResult {
    if (!iv || typeof iv !== 'string') {
      return {
        isValid: false,
        error: `Invalid IV - must be a hex string. Received: ${iv} (${typeof iv})`
      };
    }
    return { isValid: true };
  }

  /**
   * Build record anomaly response
   */
  buildRecordResponse(result: any): {
    success: boolean;
    hexId: string;
    message: string;
    endpoints: {
      decrypt: string;
      viewImage: string;
      latest: string;
    };
    data: any;
  } {
    const hexId = result._id?.toString() || 'unknown';
    const transformedResult = this.transformAnomaly(result);
    
    return {
      success: true,
      hexId: hexId,
      message: 'Anomaly recorded successfully with compressed & encrypted image',
      endpoints: this.buildResponseEndpoints(hexId),
      data: transformedResult
    };
  }

  /**
   * Add user agent to anomaly data
   */
  addUserAgent(anomalyData: any, userAgent: string): any {
    if (userAgent) {
      return {
        ...anomalyData,
        sessionMetadata: {
          ...anomalyData.sessionMetadata,
          userAgent: userAgent
        }
      };
    }
    return anomalyData;
  }
}
