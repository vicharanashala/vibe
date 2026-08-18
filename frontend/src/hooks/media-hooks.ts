import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    createVideoUploadUrl,
    deleteVideoAsset,
    getVideoAsset,
    getVideoPlaybackUrl,
    listVideoAssets,
    markVideoUploaded,
    updateVideoAsset,
    uploadVideoToSignedUrl,
} from '@/lib/api/media';
import type {
    CreateVideoUploadUrlInput,
    ListVideoAssetsOptions,
    UpdateVideoAssetInput,
    VideoAsset,
} from '@/types/media.types';

/** How often to re-check an asset that is still uploading or transcoding. */
const PROCESSING_POLL_MS = 5000;

export function useVideoAsset(assetId?: string, enabled = true) {
    return useQuery({
        queryKey: ['video-asset', assetId],
        queryFn: () => getVideoAsset(assetId!),
        enabled: Boolean(assetId) && enabled,
        /**
         * Transcoding is kicked off by a Cloud Function inside GCP and does not
         * call back into ViBe, so readiness is polled. Polling stops the moment
         * the asset reaches a terminal state.
         */
        refetchInterval: query => {
            const asset = query.state.data as VideoAsset | undefined;
            if (!asset) return PROCESSING_POLL_MS;
            return asset.status === 'READY' || asset.status === 'FAILED'
                ? false
                : PROCESSING_POLL_MS;
        },
    });
}

/**
 * The course's video library.
 *
 * Polls while anything is still processing so a freshly uploaded lecture becomes
 * selectable without the instructor reloading the page.
 */
export function useVideoAssets(
    courseId?: string,
    courseVersionId?: string,
    options: ListVideoAssetsOptions & { enabled?: boolean } = {},
) {
    const { enabled = true, ...listOptions } = options;
    const result = useQuery({
        queryKey: [
            'video-assets',
            courseId,
            courseVersionId,
            listOptions.search ?? '',
            listOptions.readyOnly ?? false,
        ],
        queryFn: () => listVideoAssets(courseId!, courseVersionId!, listOptions),
        enabled: Boolean(courseId && courseVersionId) && enabled,
        refetchInterval: query => {
            const items = (query.state.data as { items?: VideoAsset[] } | undefined)?.items;
            const anyInFlight = items?.some(
                a => a.status === 'UPLOADING' || a.status === 'PROCESSING',
            );
            return anyInFlight ? PROCESSING_POLL_MS : false;
        },
    });
    return { ...result, assets: result.data?.items ?? [] };
}

export function useUpdateVideoAsset() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: { assetId: string } & UpdateVideoAssetInput) => {
            const { assetId, ...changes } = input;
            return updateVideoAsset(assetId, changes);
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['video-assets'] });
        },
    });
}

export function useDeleteVideoAsset() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (assetId: string) => deleteVideoAsset(assetId),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['video-assets'] });
        },
    });
}

/**
 * Fetch a playback grant.
 *
 * Not cached across mounts: a grant is time-boxed, and serving a stale one from
 * cache is exactly how playback dies mid-lesson.
 */
export function useVideoPlaybackUrl(assetId?: string, enabled = true) {
    return useQuery({
        queryKey: ['video-playback-url', assetId],
        queryFn: () => getVideoPlaybackUrl(assetId!),
        enabled: Boolean(assetId) && enabled,
        gcTime: 0,
        staleTime: 0,
    });
}

export type VideoUploadPhase =
    | 'idle'
    | 'requesting'
    | 'uploading'
    | 'finalizing'
    | 'done'
    | 'error';

/**
 * The whole teacher-side upload: request a grant, PUT the bytes straight to
 * storage, then tell the backend. Exposes progress and a cancel, because these
 * files are large enough that neither is optional.
 */
export function useVideoUpload() {
    const [phase, setPhase] = useState<VideoUploadPhase>('idle');
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [asset, setAsset] = useState<VideoAsset | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const reset = useCallback(() => {
        abortRef.current = null;
        setPhase('idle');
        setProgress(0);
        setError(null);
        setAsset(null);
    }, []);

    const cancel = useCallback(() => {
        abortRef.current?.abort();
    }, []);

    const upload = useCallback(
        async (
            file: File,
            scope: Omit<
                CreateVideoUploadUrlInput,
                'fileName' | 'contentType' | 'sizeBytes'
            >,
        ): Promise<{ assetId: string } | null> => {
            const controller = new AbortController();
            abortRef.current = controller;
            setError(null);
            setProgress(0);

            try {
                setPhase('requesting');
                const grant = await createVideoUploadUrl({
                    ...scope,
                    fileName: file.name,
                    // Browsers occasionally report an empty type; fall back rather
                    // than sending a Content-Type the signature won't match.
                    contentType: file.type || 'video/mp4',
                    sizeBytes: file.size,
                });

                setPhase('uploading');
                await uploadVideoToSignedUrl({
                    uploadUrl: grant.uploadUrl,
                    file,
                    contentType: grant.requiredContentType,
                    onProgress: setProgress,
                    signal: controller.signal,
                });

                setPhase('finalizing');
                const finalized = await markVideoUploaded(grant.assetId);
                setAsset(finalized);
                setPhase('done');
                return { assetId: grant.assetId };
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Upload failed.');
                setPhase('error');
                return null;
            } finally {
                abortRef.current = null;
            }
        },
        [],
    );

    return { upload, cancel, reset, phase, progress, error, asset };
}

export function useMarkVideoUploaded() {
    return useMutation({ mutationFn: markVideoUploaded });
}
