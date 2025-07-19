import { injectable } from 'inversify';
import { Storage } from '@google-cloud/storage';
import { InternalServerError } from 'routing-controllers';
import { storageConfig } from '#root/config/storage.js';

@injectable()
export class CloudStorageService {
  private anomalyStorage: Storage;
  private bucketName: string;

  constructor() {
    this.anomalyStorage = new Storage({
      projectId: storageConfig.googleCloud.projectId
    });
    this.bucketName = storageConfig.googleCloud.anomalyBucketName;
  }

  /**
   * Upload anomaly to cloud storage
   */
  async uploadAnomaly(
    file: Express.Multer.File,
    userId: string,
    anomalyType: string,
    timestamp: Date,
    type: string,
  ): Promise<string> {
    const ext = type.split('/')[1];
    const filename = `${userId}/${anomalyType}/${timestamp.toISOString()}.${ext}`;
    const bucket = this.anomalyStorage.bucket(this.bucketName);
    const createdFile = bucket.file(filename);

    // Upload file with metadata
    await createdFile.save(file.buffer, {
      metadata: {
        contentType: 'application/octet-stream',
        anomalyType: anomalyType,
      },
    });

    return filename;
  }

  /**
   * Delete anomaly from cloud storage
   */
  async deleteAnomaly(fileName: string): Promise<void> {
    const bucket = this.anomalyStorage.bucket(this.bucketName);
    const file = bucket.file(fileName);

    try {
      await file.delete();
    } catch (error) {
      throw new InternalServerError(`Failed to delete image from cloud storage: ${error.message}`);
    }
  }

  async getSignedUrl(fileName: string): Promise<string> {
    const bucket = this.anomalyStorage.bucket(this.bucketName);
    const file = bucket.file(fileName);

    try {
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 60 * 60 * 1000,
      });
      return url;
    } catch (error) {
      throw new InternalServerError(`Failed to get signed URL: ${error.message}`);
    }
  }
}