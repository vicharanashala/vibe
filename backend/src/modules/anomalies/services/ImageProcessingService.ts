import { injectable } from 'inversify';
import sharp from 'sharp';
import crypto from 'crypto';
import { env } from '#root/utils/env.js';

export interface IImageCompressionResult {
  compressedBuffer: Buffer;
  metadata: {
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    width: number;
    height: number;
  };
}

export interface IImageEncryptionResult {
  encryptedBuffer: Buffer;
  iv: string;
  authTag: string;
  algorithm: string;
}

@injectable()
export class ImageProcessingService {
  private readonly encryptionKey: string;
  private readonly algorithm = 'aes-256-cbc';

  constructor() {
    this.encryptionKey = env('IMAGE_ENCRYPTION_KEY');
    if (!this.encryptionKey || this.encryptionKey.length < 64) {
      throw new Error('IMAGE_ENCRYPTION_KEY must be at least 64 characters long');
    }
  }

  /**
   * Compress image using Sharp with optimized settings
   */
  async compressImage(imageBuffer: Buffer): Promise<IImageCompressionResult> {
    try {
      console.log(`📸 Starting image compression. Original size: ${imageBuffer.length} bytes`);

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

      console.log(`✅ Image compressed successfully:`, metadata);
      return { compressedBuffer, metadata };

    } catch (error) {
      console.error('❌ Image compression failed:', error);
      throw new Error(`Image compression failed: ${error.message}`);
    }
  }

  /**
   * Encrypt buffer using AES-256-CBC
   */
  encryptBuffer(buffer: Buffer): IImageEncryptionResult {
    try {
      console.log(`🔒 Starting buffer encryption. Size: ${buffer.length} bytes`);

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

      console.log(`✅ Buffer encrypted successfully. IV: ${iv.toString('hex').substring(0, 8)}...`);

      return {
        encryptedBuffer,
        iv: iv.toString('hex'),
        authTag: '', // Not used with CBC
        algorithm: this.algorithm,
      };

    } catch (error) {
      console.error('❌ Buffer encryption failed:', error);
      throw new Error(`Buffer encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt buffer using AES-256-CBC
   */
  decryptBuffer(encryptedBuffer: Buffer, iv: string, authTag: string): Buffer {
    try {
      console.log(`🔓 Starting buffer decryption. Size: ${encryptedBuffer.length} bytes`);

      // Create decipher with the encryption key as a Buffer
      const keyBuffer = Buffer.from(this.encryptionKey, 'hex').slice(0, 32); // Use first 32 bytes for AES-256
      const ivBuffer = Buffer.from(iv, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, keyBuffer, ivBuffer);

      // Decrypt data
      const decryptedBuffer = Buffer.concat([
        decipher.update(encryptedBuffer),
        decipher.final()
      ]);

      console.log(`✅ Buffer decrypted successfully`);
      return decryptedBuffer;

    } catch (error) {
      console.error('❌ Buffer decryption failed:', error);
      throw new Error(`Buffer decryption failed: ${error.message}`);
    }
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