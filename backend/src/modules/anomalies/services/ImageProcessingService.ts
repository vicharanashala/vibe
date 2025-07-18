import { injectable } from 'inversify';
import sharp from 'sharp';
import crypto from 'crypto';
import { InternalServerError } from 'routing-controllers';
import { storageConfig } from '#root/config/storage.js';
import { IImageCompressionResult, IImageEncryptionResult } from '../classes/transformers/Anomaly.js';

@injectable()
export class ImageProcessingService {
  private readonly encryptionKey: string;
  private readonly algorithm = 'aes-256-cbc';

  constructor() {
    this.encryptionKey = storageConfig.encryption.imageEncryptionKey;
    if (!this.encryptionKey || this.encryptionKey.length < 64) {
      throw new InternalServerError('IMAGE_ENCRYPTION_KEY must be at least 64 characters long');
    }
  }

  /**
   * Compress image using Sharp with optimized settings
   */
  async compressImage(imageBuffer: Buffer): Promise<IImageCompressionResult> {
    // Get original image metadata
    const originalMetadata = await sharp(imageBuffer).metadata();
    const originalSize = imageBuffer.length;

    // Compress image with optimized settings
    const compressedBuffer = await sharp(imageBuffer)
      .jpeg({
        quality: 70,           // 70% quality for good balance
        progressive: true,     // Progressive JPEG for better loading
        mozjpeg: true,        // Use mozjpeg encoder for better compression
        optimizeScans: true,  // Optimize scan order
        overshootDeringing: true, // Reduce artifacts
      })
      .resize({
        width: 1280,          // Max width 1280px
        height: 720,          // Max height 720px
        fit: 'inside',        // Maintain aspect ratio
        withoutEnlargement: true, // Don't enlarge smaller images
      })
      .toBuffer();

    const compressedSize = compressedBuffer.length;
    const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

    const metadata = {
      originalSize,
      compressedSize,
      compressionRatio: Math.round(compressionRatio * 100) / 100,
      width: originalMetadata.width || 0,
      height: originalMetadata.height || 0,
    };

    return { compressedBuffer, metadata };
  }

  /**
   * Encrypt buffer using AES-256-CBC
   */
  private encryptBuffer(buffer: Buffer): IImageEncryptionResult {
    // Generate random initialization vector
    const iv = crypto.randomBytes(16);

    // Create cipher with the encryption key as a Buffer
    const keyBuffer = Buffer.from(this.encryptionKey, 'hex').slice(0, 32); // Use first 32 bytes for AES-256
    const cipher = crypto.createCipheriv(this.algorithm, keyBuffer, iv);

    // Encrypt data
    const encryptedBuffer = Buffer.concat([
      cipher.update(buffer),
      cipher.final()
    ]);

    return {
      encryptedBuffer,
      iv: iv.toString('hex'),
      authTag: '', // Not used with CBC
      algorithm: this.algorithm,
    };
  }

  /**
   * Decrypt buffer using AES-256-CBC
   */
  private decryptBuffer(encryptedBuffer: Buffer, iv: string, authTag: string): Buffer {
    // Create decipher with the encryption key as a Buffer
    const keyBuffer = Buffer.from(this.encryptionKey, 'hex').slice(0, 32); // Use first 32 bytes for AES-256
    const ivBuffer = Buffer.from(iv, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, keyBuffer, ivBuffer);

    // Decrypt data
    const decryptedBuffer = Buffer.concat([
      decipher.update(encryptedBuffer),
      decipher.final()
    ]);

    return decryptedBuffer;
  }

  /**
   * Decrypt image buffer using provided encryption metadata
   */
  public decryptImage(encryptedBuffer: Buffer, iv: string, authTag: string): Buffer {
    return this.decryptBuffer(encryptedBuffer, iv, authTag);
  }

  /**
   * Process image: compress then encrypt
   */
  async processImage(imageBuffer: Buffer): Promise<{
    encryptionResult: IImageEncryptionResult;
    compressionMetadata: IImageCompressionResult['metadata'];
  }> {
    // Step 1: Compress image
    const { compressedBuffer, metadata } = await this.compressImage(imageBuffer);

    // Step 2: Encrypt compressed image
    const encryptionResult = this.encryptBuffer(compressedBuffer);

    return {
      encryptionResult,
      compressionMetadata: metadata,
    };
  }
}