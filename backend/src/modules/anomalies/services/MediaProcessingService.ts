import { injectable } from 'inversify';
import crypto from 'crypto';
import { InternalServerError } from 'routing-controllers';
import { storageConfig } from '#root/config/storage.js';
import { IEncryptionResult } from '../classes/transformers/Anomaly.js';

@injectable()
export class MediaProcessingService {
  private readonly encryptionKey: string;
  private readonly algorithm = 'aes-256-cbc';

  constructor() {
    this.encryptionKey = storageConfig.encryption.mediaEncryptionKey;
    if (!this.encryptionKey) {
      throw new InternalServerError('MEDIA_ENCRYPTION_KEY must be provided');
    }

    // Validate hex format
    if (!/^[0-9a-fA-F]+$/.test(this.encryptionKey)) {
      throw new InternalServerError('MEDIA_ENCRYPTION_KEY must be a valid hexadecimal string');
    }
  }

  /**
   * Encrypt buffer using AES-256-CBC
   */
  encryptBuffer(buffer: Buffer): IEncryptionResult {
    // Generate random initialization vector
    const iv = crypto.randomBytes(16);

    // Create cipher with the encryption key as a Buffer
    const keyBuffer = Buffer.from(this.encryptionKey, 'hex');
    if (keyBuffer.length !== 32) {
      throw new InternalServerError('Invalid encryption key length = ' + keyBuffer.length);
    }
    const cipher = crypto.createCipheriv(this.algorithm, keyBuffer, iv);

    // Encrypt data
    const encryptedBuffer = Buffer.concat([
      cipher.update(buffer),
      cipher.final()
    ]);

    return {
      encryptedBuffer,
      iv: iv.toString('hex'),
      algorithm: this.algorithm,
    };
  }

  /**
   * Decrypt buffer using AES-256-CBC
   */
  decryptBuffer(encryptedBuffer: Buffer, iv: string): Buffer {
    // Create decipher with the encryption key as a Buffer
    const keyBuffer = Buffer.from(this.encryptionKey, 'hex');
    const ivBuffer = Buffer.from(iv, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, keyBuffer, ivBuffer);

    // Decrypt data
    const decryptedBuffer = Buffer.concat([
      decipher.update(encryptedBuffer),
      decipher.final()
    ]);

    return decryptedBuffer;
  }
}