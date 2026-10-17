import type {
  CreateVideoUploadUrlInput,
  ListVideoAssetsOptions,
  UpdateVideoAssetInput,
  VideoAsset,
  VideoPlaybackGrant,
  VideoUploadGrant,
} from '@/types/media.types';

/**
 * Video-asset endpoints.
 *
 * Hand-rolled rather than going through the typed `api` client because
 * `backend/scripts/generate-openapi.cjs` is a placeholder that emits only a
 * /health path — regenerating schema.ts from it would delete every existing
 * frontend type. Same approach as lib/api/hp-system.ts.
 */
const BASE_URL = `${import.meta.env.VITE_BASE_URL}/media/video-assets`;

function getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('firebase-auth-token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        ...options,
        headers: { ...getAuthHeaders(), ...(options?.headers || {}) },
        credentials: 'include',
    });
    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const err: any = new Error(errData.message || `Request failed (${res.status})`);
        err.data = errData;
        throw err;
    }
    return res.json();
}

/** Reserve an asset and get a signed URL to upload to. */
export async function createVideoUploadUrl(
    input: CreateVideoUploadUrlInput,
): Promise<VideoUploadGrant> {
    return apiFetch<VideoUploadGrant>(`${BASE_URL}/upload-url`, {
        method: 'POST',
        body: JSON.stringify(input),
    });
}

/** Tell the backend the upload finished. Verified against storage server-side. */
export async function markVideoUploaded(assetId: string): Promise<VideoAsset> {
    return apiFetch<VideoAsset>(`${BASE_URL}/${assetId}/uploaded`, {
        method: 'POST',
    });
}

/** Current processing status. Refreshes readiness from storage server-side. */
export async function getVideoAsset(assetId: string): Promise<VideoAsset> {
    return apiFetch<VideoAsset>(`${BASE_URL}/${assetId}`);
}

/** A time-boxed HLS playback grant. */
export async function getVideoPlaybackUrl(
    assetId: string,
): Promise<VideoPlaybackGrant> {
    return apiFetch<VideoPlaybackGrant>(`${BASE_URL}/${assetId}/playback-url`);
}

/** The course's video library. */
export async function listVideoAssets(
    courseId: string,
    courseVersionId: string,
    options: ListVideoAssetsOptions = {},
): Promise<{ items: VideoAsset[] }> {
    const query = new URLSearchParams({ courseId, courseVersionId });
    if (options.limit) query.set('limit', String(options.limit));
    if (options.search) query.set('search', options.search);
    if (options.readyOnly) query.set('readyOnly', 'true');
    return apiFetch<{ items: VideoAsset[] }>(`${BASE_URL}?${query.toString()}`);
}

/** Rename a video, or record its duration once known. */
export async function updateVideoAsset(
    assetId: string,
    input: UpdateVideoAssetInput,
): Promise<VideoAsset> {
    return apiFetch<VideoAsset>(`${BASE_URL}/${assetId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
    });
}

/** Remove a video from the library. Rejected if a lesson still uses it. */
export async function deleteVideoAsset(
    assetId: string,
): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`${BASE_URL}/${assetId}`, {
        method: 'DELETE',
    });
}

/**
 * PUT the file straight to cloud storage.
 *
 * Deliberately raw XHR, not fetch, for two reasons:
 * - fetch cannot report upload progress, and these files are large enough that
 *   a teacher needs a progress bar.
 * - the request must carry NO ViBe auth headers. The signature is the
 *   authorization; sending an Authorization header makes storage reject it.
 *
 * `contentType` must be exactly the grant's `requiredContentType`.
 */
export function uploadVideoToSignedUrl(input: {
    uploadUrl: string;
    file: File;
    contentType: string;
    onProgress?: (percent: number) => void;
    signal?: AbortSignal;
}): Promise<void> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', input.uploadUrl, true);
        xhr.setRequestHeader('Content-Type', input.contentType);

        xhr.upload.onprogress = event => {
            if (event.lengthComputable && input.onProgress) {
                input.onProgress(Math.round((event.loaded / event.total) * 100));
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve();
            } else {
                reject(
                    new Error(
                        `Upload failed (${xhr.status}). If this is a 403, the signed URL ` +
                        'may have expired or the Content-Type did not match.',
                    ),
                );
            }
        };
        xhr.onerror = () => reject(new Error('Upload failed: network error.'));
        xhr.onabort = () => reject(new Error('Upload cancelled.'));

        input.signal?.addEventListener('abort', () => xhr.abort());

        xhr.send(input.file);
    });
}
