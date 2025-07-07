import { env } from '#root/utils/env.js';

export const storageConfig = {
  googleCloud: {
    projectId: env('GOOGLE_CLOUD_PROJECT_ID'),
    clientEmail: env('GOOGLE_CLIENT_EMAIL'),
    privateKey: env('GOOGLE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
    bucketName: env('GOOGLE_STORAGE_BUCKET') || 'vibe-faces-storage',
  },
  encryption: {
    imageEncryptionKey: env('IMAGE_ENCRYPTION_KEY'),
  },
};
