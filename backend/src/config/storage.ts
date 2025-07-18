import { env } from '#root/utils/env.js';

export const storageConfig = {
  googleCloud: {
    projectId: env('GCLOUD_PROJECT'),
    anomalyBucketName: env('GOOGLE_ANOMALY_BUCKET') || 'vibe-anomaly-data',
    facesBucketName: env('GOOGLE_FACES_BUCKET') || 'vibe-faces-data',
  },
  encryption: {
    imageEncryptionKey: env('IMAGE_ENCRYPTION_KEY'),
  },
};
