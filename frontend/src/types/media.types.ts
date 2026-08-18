/** Lifecycle of an uploaded video. Mirrors the backend's VideoAssetStatus. */
export type VideoAssetStatus =
  | 'UPLOADING'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED';

export interface VideoUploadGrant {
  assetId: string;
  /** Signed URL to PUT the file to. Bytes go straight to storage. */
  uploadUrl: string;
  uploadObjectKey: string;
  expiresAt: string;
  /**
   * The Content-Type header the PUT must send, byte for byte. It is baked into
   * the signature, so any other value is rejected by storage.
   */
  requiredContentType: string;
}

export interface VideoAsset {
  assetId: string;
  status: VideoAssetStatus;
  /** Library display name, editable after upload. */
  title: string;
  description?: string;
  originalFileName: string;
  /** True when a playback grant can be issued. */
  playable: boolean;
  sizeBytes?: number;
  durationSeconds?: number;
  failureReason?: string;
  createdAt: string;
}

export interface VideoPlaybackGrant {
  /** HLS master playlist URL. */
  url: string;
  /** When the grant stops working. */
  expiresAt: string;
}

export interface CreateVideoUploadUrlInput {
  courseId: string;
  courseVersionId: string;
  fileName: string;
  contentType: string;
  sizeBytes?: number;
  title?: string;
  description?: string;
}

export interface UpdateVideoAssetInput {
  title?: string;
  description?: string;
  /** Reported once the video loads; prefills and validates segment timestamps. */
  durationSeconds?: number;
}

export interface ListVideoAssetsOptions {
  search?: string;
  /** Only playable videos — a still-processing upload cannot be segmented. */
  readyOnly?: boolean;
  limit?: number;
}

/** Where an item's video comes from. Lets uploaded and YouTube video coexist. */
export type VideoSource = 'YOUTUBE' | 'GCS';

/**
 * Resolve a video item's source, treating an absent value as YOUTUBE.
 *
 * Mirrors resolveVideoSource in the backend's shared/interfaces/models.ts. Every
 * video item created before uploads existed has no `source`, so absent must keep
 * meaning YouTube or existing courses stop playing.
 */
export function resolveVideoSource(details?: {
    source?: VideoSource;
}): VideoSource {
    return details?.source ?? 'YOUTUBE';
}
