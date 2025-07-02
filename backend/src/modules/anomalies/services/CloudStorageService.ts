import { injectable, inject } from 'inversify';
import { Storage } from '@google-cloud/storage';
import { env } from '#root/utils/env.js';
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
    try {
      this.storage = new Storage({
        projectId: env('GOOGLE_CLOUD_PROJECT_ID'),
        credentials: {
          client_email: env('GOOGLE_CLIENT_EMAIL'),
          private_key: env('GOOGLE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
        },
      });

      this.bucketName = env('GOOGLE_STORAGE_BUCKET') || 'vibe-faces-storage';
      console.log(`☁️ Cloud Storage initialized. Bucket: ${this.bucketName}`);

    } catch (error) {
      console.error('❌ Failed to initialize Cloud Storage:', error);
      throw new Error(`Cloud Storage initialization failed: ${error.message}`);
    }
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
    try {
      console.log(`☁️ Starting cloud upload for user ${userId}, anomaly: ${anomalyType}`);

      // Use ImageProcessingService to process image (compress + encrypt)
      const { encryptionResult, compressionMetadata } = await this.imageProcessingService.processImage(imageBuffer);

      // Generate unique filename
      const timestampStr = timestamp.toISOString().replace(/[:.]/g, '-');
      const fileName = `anomalies/${userId}/${timestampStr}_${anomalyType}.encrypted`;

      // Get bucket and file reference
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);

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

      // Generate signed URL (valid for 1 hour)
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 60 * 60 * 1000, // 1 hour
      });

      console.log(`✅ Image uploaded successfully: ${fileName}`);

      return {
        imageUrl: signedUrl,
        fileName,
        encryptedImageData: encryptionResult,
        imageMetadata: compressionMetadata,
      };

    } catch (error) {
      console.error('❌ Cloud upload failed:', error);
      throw new Error(`Cloud upload failed: ${error.message}`);
    }
  }

  /**
   * Delete anomaly image from cloud storage
   */
  async deleteAnomalyImage(fileName: string): Promise<void> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);

      await file.delete();
      console.log(`✅ Image deleted successfully: ${fileName}`);

    } catch (error) {
      console.error('❌ Failed to delete image:', error);
      throw new Error(`Failed to delete image: ${error.message}`);
    }
  }

  /**
   * Download and decrypt anomaly image
   */
  async downloadAndDecryptImage(fileName: string): Promise<Buffer> {
    try {
      console.log(`📥 Downloading and decrypting: ${fileName}`);

      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);

      // Download file
      const [fileBuffer] = await file.download();
      const [metadata] = await file.getMetadata();

      // Extract encryption data from metadata
      const encryptionMetadata = metadata.metadata;
      if (!encryptionMetadata.encrypted || !encryptionMetadata.iv || !encryptionMetadata.authTag) {
        throw new Error('File is not properly encrypted or missing encryption metadata');
      }

      // Use ImageProcessingService to decrypt file
      const decryptedBuffer = this.imageProcessingService.decryptBuffer(
        fileBuffer,
        String(encryptionMetadata.iv),
        String(encryptionMetadata.authTag)
      );

      console.log(`✅ Image downloaded and decrypted successfully`);
      return decryptedBuffer;

    } catch (error) {
      console.error('❌ Failed to download and decrypt image:', error);
      throw new Error(`Failed to download and decrypt image: ${error.message}`);
    }
  }
}