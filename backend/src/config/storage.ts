import { env } from '#root/utils/env.js';

export const storageConfig = {
  googleCloud: {
    projectId: env('GCLOUD_PROJECT'),
    anomalyBucketName: env('GOOGLE_ANOMALY_BUCKET') || 'vibe-anomaly-data',
    facesBucketName: env('GOOGLE_FACES_BUCKET') || 'vibe-faces-data',
    aiServerBucketName: env('GOOGLE_AI_SERVER_BUCKET') || 'vibe-aiserver-data',
  },
  encryption: {
    mediaEncryptionKey: env('MEDIA_ENCRYPTION_KEY'),
  },
};
