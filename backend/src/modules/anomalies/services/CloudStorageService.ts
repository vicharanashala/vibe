import { injectable, inject } from 'inversify';
import { Storage } from '@google-cloud/storage';
import { InternalServerError, BadRequestError } from 'routing-controllers';
import { storageConfig } from '#root/config/storage.js';
import { ImageProcessingService, IImageEncryptionResult } from './ImageProcessingService.js';
import { ANOMALIES_TYPES } from '../types.js';

export interface ICloudStorageResult {
  imageUrl: string;
  fileName: string;
  encryptedImageData: IImageEncryptionResult;
  imageMetadata: any;
}

@injectable()
export class CloudStorageService {
  private storage: Storage;
  private bucketName: string;

  constructor(
    @inject(ANOMALIES_TYPES.ImageProcessingService) private imageProcessingService: ImageProcessingService
  ) {
    this.initializeStorage();
  }

  private initializeStorage(): void {
    this.storage = new Storage({
      projectId: storageConfig.googleCloud.projectId,
      credentials: {
        client_email: storageConfig.googleCloud.clientEmail,
        private_key: storageConfig.googleCloud.privateKey,
      },
    });

    this.bucketName = storageConfig.googleCloud.bucketName;
  }

  /**
   * Upload anomaly image to cloud storage
   */
  async uploadAnomalyImage(
    imageBuffer: Buffer,
    userId: string,
    timestamp: Date,
    anomalyType: string
  ): Promise<ICloudStorageResult> {
    // Use ImageProcessingService to process image (compress + encrypt)
    const { encryptionResult, compressionMetadata } = await this.imageProcessingService.processImage(imageBuffer);

    // Generate unique filename
    const timestampStr = timestamp.toISOString().replace(/[:.]/g, '-');
    const fileName = `anomalies/${userId}/${timestampStr}_${anomalyType}.encrypted`;

    // Get bucket and file reference
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(fileName);

    try {
      // Upload encrypted image with metadata
      await file.save(encryptionResult.encryptedBuffer, {
        metadata: {
          contentType: 'application/octet-stream',
          metadata: {
            userId,
            timestamp: timestamp.toISOString(),
            anomalyType,
            uploadedAt: new Date().toISOString(),
            // Encryption metadata
            encrypted: 'true',
            algorithm: encryptionResult.algorithm,
            iv: encryptionResult.iv,
            authTag: encryptionResult.authTag,
            // Compression metadata
            originalSize: String(compressionMetadata.originalSize),
            compressedSize: String(compressionMetadata.compressedSize),
            compressionRatio: String(compressionMetadata.compressionRatio),
          },
        },
      });
    } catch (error) {
      throw new InternalServerError(`Failed to upload image to cloud storage: ${error.message}`);
    }

    // Generate signed URL (valid for 1 hour)
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    return {
      imageUrl: signedUrl,
      fileName,
      encryptedImageData: encryptionResult,
      imageMetadata: compressionMetadata,
    };
  }

  /**
   * Delete anomaly image from cloud storage
   */
  async deleteAnomalyImage(fileName: string): Promise<void> {
    const bucket = this.storage.bucket(this.bucketName);
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
    const bucket = this.storage.bucket(this.bucketName);
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