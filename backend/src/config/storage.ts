import { env } from '#root/utils/env.js';

export const storageConfig = {
  googleCloud: {
    projectId: env('GCLOUD_PROJECT'),
    anomalyBucketName: env('GOOGLE_ANOMALY_BUCKET') || 'vibe-anomaly-data',
    facesBucketName: env('GOOGLE_FACES_BUCKET') || 'vibe-faces-data',
    aiServerBucketName: env('GOOGLE_AI_SERVER_BUCKET') || 'vibe-aiserver-data',
    /**
     * Exam question/option images and proctoring-violation snapshots
     * (`modules/exams`). Kept as its own bucket rather than reusing
     * `anomalyBucketName`/`facesBucketName` since exam media is a distinct
     * logical concern (teacher-authored content + student attempt audit
     * trail) with no relation to the anomalies module.
     */
    examMediaBucketName: env('GOOGLE_EXAM_MEDIA_BUCKET') || 'vibe-exam-media',
  },
  encryption: {
    mediaEncryptionKey: env('MEDIA_ENCRYPTION_KEY'),
  },

  /**
   * Uploaded-video pipeline (media module). Teachers upload straight to
   * `uploadBucket`; a cloud transcoder writes an HLS ladder into
   * `streamBucket`; the backend only ever signs URLs for either.
   *
   * Bucket names and the playlist layout are deployment facts — see
   * `modules/media/services/storage/videoStoragePaths.ts` for the single place
   * the output naming convention is encoded.
   */
  video: {
    /**
     * GCP project owning the video buckets.
     *
     * Deliberately its OWN variable rather than reusing GCLOUD_PROJECT: that one
     * is read by the Firebase Admin SDK to decide which project to verify ID
     * tokens against, so pointing it at the video project makes Firebase reject
     * every token with an "incorrect aud claim" error. Keep the two separate.
     */
    projectId: env('GOOGLE_VIDEO_PROJECT_ID') || env('GCLOUD_PROJECT'),
    /**
     * Raw teacher uploads land here. Writing an object into this bucket is what
     * triggers the Cloud Function that starts transcoding — so the upload is
     * the pipeline's only entry point; ViBe never calls the transcoder.
     */
    uploadBucketName:
      env('GOOGLE_VIDEO_UPLOAD_BUCKET') ||
      'hls-streaming-gcp-raw-files-vibe-5b35a',
    /** Transcoded HLS variants + master playlists are written here. */
    streamBucketName:
      env('GOOGLE_VIDEO_STREAM_BUCKET') ||
      'hls-streaming-gcp-processed-files-vibe-5b35a',
    /** Lifetime of an issued upload URL. One hour covers a large upload. */
    uploadUrlTtlMinutes: Number(env('VIDEO_UPLOAD_URL_TTL_MINUTES') || '60'),
    /**
     * Lifetime of an issued playback URL. HLS re-requests segments for the whole
     * session, so this must exceed the longest expected watch or playback dies
     * mid-lesson. Six hours is deliberately generous; switching to CDN signed
     * cookies (see PlaybackUrlProvider) removes the constraint entirely.
     */
    playbackUrlTtlMinutes: Number(
      env('VIDEO_PLAYBACK_URL_TTL_MINUTES') || '360',
    ),
    /** Largest upload we will issue a URL for (bytes). Default 2 GiB. */
    maxUploadBytes: Number(env('VIDEO_MAX_UPLOAD_BYTES') || `${2 * 1024 ** 3}`),

    /**
     * Cloud CDN in front of the stream bucket, e.g. cdn.vibe.vicharanashala.ai.
     * When set, playback is served through the CDN instead of the storage API —
     * cached at the edge, and signable across a whole path prefix.
     */
    cdnHost: env('GOOGLE_VIDEO_CDN_HOST'),
    /** http while the LB's certificate is still being provisioned. */
    cdnScheme: env('GOOGLE_VIDEO_CDN_SCHEME') || 'https',
    /**
     * Cloud CDN signed-URL key. GCP will not reveal the value after creation, so
     * it has to be captured at `add-signed-url-key` time and supplied here.
     *
     * Without it, CDN playback URLs are unsigned — which only works while the
     * bucket allows public read, and is therefore a temporary state, not a
     * design. Supplying the key is what makes playback actually protected.
     */
    cdnKeyName: env('GOOGLE_VIDEO_CDN_KEY_NAME'),
    cdnKeyValue: env('GOOGLE_VIDEO_CDN_KEY_VALUE'),
  },
};
