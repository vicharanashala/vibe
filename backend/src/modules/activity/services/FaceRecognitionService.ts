import 'reflect-metadata';
import {injectable} from 'inversify';
import {Storage} from '@google-cloud/storage';
import {NotFoundError, BadRequestError} from 'routing-controllers';
import * as path from 'path';

export interface KnownFace {
  label: string;
  imagePaths: string[];
}

@injectable()
export class FaceRecognitionService {
  private storage: Storage;
  private bucket: string;
  constructor() {
    // Validate required environment variables
    if (
      !process.env.GOOGLE_CLOUD_PROJECT_ID ||
      !process.env.GOOGLE_CLIENT_EMAIL ||
      !process.env.GOOGLE_PRIVATE_KEY ||
      !process.env.GOOGLE_STORAGE_BUCKET
    ) {
      console.error('Missing required GCS environment variables');
    }

    try {
      this.storage = new Storage({
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY,
          client_id: process.env.GOOGLE_CLIENT_ID,
        },
      });
      this.bucket = process.env.GOOGLE_STORAGE_BUCKET || '';
    } catch (error) {
      console.error('Error initializing Google Cloud Storage:', error);
      throw new Error(
        `Failed to initialize Google Cloud Storage: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Verifies GCS connection and bucket access
   * @returns Promise with connection status
   */
  async verifyGCSConnection(): Promise<{success: boolean; message: string}> {
    try {
      if (!this.bucket) {
        return {
          success: false,
          message:
            'Bucket name not specified in GOOGLE_STORAGE_BUCKET environment variable',
        };
      }

      // Check if we can access the bucket
      const [exists] = await this.storage.bucket(this.bucket).exists();

      if (!exists) {
        return {
          success: false,
          message: `Bucket ${this.bucket} does not exist or is not accessible`,
        };
      }

      // Try to list files to verify permissions
      await this.storage.bucket(this.bucket).getFiles({maxResults: 1});

      return {
        success: true,
        message: `Successfully connected to bucket ${this.bucket}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to connect to GCS: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
  async getKnownFaces(): Promise<KnownFace[]> {
    try {
      const [files] = await this.storage.bucket(this.bucket).getFiles({
        prefix: 'faces/',
      });

      const labeledFaces: {[key: string]: string[]} = {};

      for (const file of files) {
        const match = file.name.match(/faces\/([^/]+)\//);
        if (match) {
          const personName = match[1];
          if (!file.name.endsWith('.keep')) {
            // Generate signed URL instead of public URL for uniform bucket-level access
            try {
              const [signedUrl] = await file.getSignedUrl({
                action: 'read',
                expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year from now
              });

              if (!labeledFaces[personName]) {
                labeledFaces[personName] = [];
              }
              labeledFaces[personName].push(signedUrl);
            } catch (err) {
              console.warn(
                `Failed to generate signed URL for file: ${file.name}`,
                err,
              );
            }
          }
        }
      }

      const result = Object.entries(labeledFaces).map(
        ([label, imagePaths]) => ({
          label,
          imagePaths: imagePaths.filter(url => {
            // For signed URLs, check if the path contains image extensions before query parameters
            const urlPath = url.split('?')[0]; // Remove query parameters
            return urlPath.match(/\.(jpg|jpeg|png|gif|webp)$/i);
          }),
        }),
      );

      return result;
    } catch (error) {
      console.error('Error reading faces:', error);
      throw new NotFoundError('Error reading known faces');
    }
  }
  async uploadFaceImage(
    personName: string,
    file: Express.Multer.File,
  ): Promise<{path: string}> {
    // Validate input parameters
    if (!personName) {
      throw new BadRequestError('Person name is required');
    }

    if (!file) {
      throw new BadRequestError('File is required');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestError('File buffer is empty or invalid');
    }

    if (!file.mimetype) {
      throw new BadRequestError('File mimetype is missing');
    }

    // Validate GCS config
    if (!this.bucket) {
      throw new Error('Google Storage bucket is not configured');
    }

    try {
      // Get existing files to determine the next number
      const [files] = await this.storage.bucket(this.bucket).getFiles({
        prefix: `faces/${personName}/`,
      });

      // Count existing image files (excluding .keep)
      const imageCount = files.filter(
        file => !file.name.endsWith('.keep'),
      ).length;
      const nextNumber = imageCount + 1;

      const fileExtension = path.extname(file.originalname) || '.jpg';
      const filename = `faces/${personName}/${personName}${nextNumber}${fileExtension}`;

      const fileRef = this.storage.bucket(this.bucket).file(filename);

      // Set proper metadata for the file
      const metadata = {
        contentType: file.mimetype,
        cacheControl: 'public, max-age=31536000',
        metadata: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Cache-Control': 'public, max-age=31536000',
        },
      }; // Upload with metadata - without ACL operations for uniform bucket-level access
      try {
        await fileRef.save(file.buffer, {
          metadata: metadata,
        });
      } catch (uploadError) {
        console.error('Error during file.save operation:', uploadError);
        throw new Error(
          `GCS upload failed: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`,
        );
      }

      // Generate a signed URL for accessing the file (valid for 1 year)
      const [signedUrl] = await fileRef.getSignedUrl({
        action: 'read',
        expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year from now
      });

      // Return the signed URL
      return {path: signedUrl};
    } catch (error) {
      console.error('Error uploading file:', error);
      // Check if environment variables are properly set
      if (
        !process.env.GOOGLE_CLOUD_PROJECT_ID ||
        !process.env.GOOGLE_CLIENT_EMAIL ||
        !process.env.GOOGLE_PRIVATE_KEY ||
        !process.env.GOOGLE_STORAGE_BUCKET
      ) {
        console.error('Missing GCS environment variables');
        throw new Error(
          'GCS configuration is incomplete. Missing required environment variables.',
        );
      }

      // Pass the specific error message to make debugging easier
      if (error instanceof Error) {
        throw new Error(`Failed to upload file: ${error.message}`);
      } else {
        throw new Error('Failed to upload file: Unknown error');
      }
    }
  }

  async addNewPerson(personName: string): Promise<{path: string}> {
    if (!personName) {
      throw new BadRequestError('personName is required');
    }

    try {
      const filename = `faces/${personName}/.keep`;
      const fileRef = this.storage.bucket(this.bucket).file(filename);
      await fileRef.save('');

      return {
        path: `faces/${personName}`,
      };
    } catch (error) {
      console.error('Error creating person directory:', error);
      throw new Error('Failed to create person directory');
    }
  }
}
