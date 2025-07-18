import { injectable, inject } from 'inversify';
import { Storage } from '@google-cloud/storage';
import { InternalServerError, BadRequestError } from 'routing-controllers';
import { storageConfig } from '#root/config/storage.js';
import { ImageProcessingService } from './ImageProcessingService.js';
import { ANOMALIES_TYPES } from '../types.js';

@injectable()
export class CloudStorageService {
  private anomalyStorage: Storage;
  private bucketName: string;

  constructor(
    @inject(ANOMALIES_TYPES.ImageProcessingService) private imageProcessingService: ImageProcessingService
  ) {
    this.initializeStorage();
  }

  private initializeStorage(): void {
    this.anomalyStorage = new Storage({
      projectId: storageConfig.googleCloud.projectId
    });
    this.bucketName = storageConfig.googleCloud.anomalyBucketName;
  }

  /**
   * Upload anomaly image to cloud storage
   */
  async uploadAnomalyImage(
    imageBuffer: Buffer,
    userId: string,
    anomalyType: string,
    timestamp: Date
  ): Promise<string> {
    // Use ImageProcessingService to process image (compress + encrypt)
    const { encryptionResult } = await this.imageProcessingService.processImage(imageBuffer);

    // Generate unique filename
    const timestampStr = timestamp.toISOString().replace(/[:.-]/g, '');
    const fileName = `${userId}/${anomalyType}/${timestampStr}.encrypted`;

    // Get bucket and file reference
    const bucket = this.anomalyStorage.bucket(this.bucketName);
    const file = bucket.file(fileName);

    // Upload encrypted image with metadata
    await file.save(encryptionResult.encryptedBuffer, {
      metadata: {
        contentType: 'application/octet-stream',
        metadata: {
          anomalyType,
          encrypted: 'true',
          algorithm: encryptionResult.algorithm,
          iv: encryptionResult.iv,
          authTag: encryptionResult.authTag,
        },
      },
    });

    return fileName;
  }

  /**
   * Delete anomaly image from cloud storage
   */
  async deleteAnomalyImage(fileName: string): Promise<void> {
    const bucket = this.anomalyStorage.bucket(this.bucketName);
    const file = bucket.file(fileName);

    try {
      await file.delete();
    } catch (error) {
      throw new InternalServerError(`Failed to delete image from cloud storage: ${error.message}`);
    }
  }

  /**
   * Download and decrypt anomaly image
   */
  async downloadAndDecryptImage(fileName: string): Promise<Buffer> {
    const bucket = this.anomalyStorage.bucket(this.bucketName);
    const file = bucket.file(fileName);

    // Download file
    const [fileBuffer] = await file.download();
    const [metadata] = await file.getMetadata();

    // Extract encryption data from metadata
    const encryptionMetadata = metadata.metadata;
    if (!encryptionMetadata.encrypted || !encryptionMetadata.iv || !encryptionMetadata.authTag) {
      throw new BadRequestError('File is not properly encrypted or missing encryption metadata');
    }

    // Use ImageProcessingService to decrypt file
    const decryptedBuffer = this.imageProcessingService.decryptImage(
      fileBuffer,
      String(encryptionMetadata.iv),
      String(encryptionMetadata.authTag)
    );

    return decryptedBuffer;
  }
}