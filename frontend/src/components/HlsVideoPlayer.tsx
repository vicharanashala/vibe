import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from 'react';
import Hls from 'hls.js';
import { getVideoPlaybackUrl } from '@/lib/api/media';

/**
 * Player for videos uploaded to ViBe and transcoded to HLS.
 *
 * This is a deliberate SIBLING of components/video.tsx, not a replacement. That
 * component drives the YouTube IFrame API and every existing course depends on
 * it, so it is left untouched; an item picks a player by its `source`
 * discriminator.
 *
 * ⚠️ Phase 1 scope: playback only. Watch-time tracking, rewind/fast-forward
 * anomaly capture, proctoring gates, emotion capture and linear-progression
 * enforcement are all still wired exclusively to the YouTube player. Porting
 * them is phase 2 — this player must not be used for graded content until then.
 * The imperative handle below intentionally mirrors YTPlayerInstance so that
 * port is mechanical rather than a rewrite.
 */

/** Mirrors the YouTube player surface the rest of the app already speaks. */
export interface HlsPlayerHandle {
    playVideo: () => void;
    pauseVideo: () => void;
    seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
    getCurrentTime: () => number;
    getDuration: () => number;
    getVolume: () => number;
    setVolume: (volume: number) => void;
    getPlaybackRate: () => number;
    setPlaybackRate: (rate: number) => void;
}

export interface HlsVideoPlayerProps {
    /** Video asset to play. A playback grant is fetched for it on mount. */
    assetId: string;
    /** Segment start, HH:MM:SS — video items are segments of a longer video. */
    startTime?: string;
    /** Segment end, HH:MM:SS. Playback stops here and fires onEnded. */
    endTime?: string;
    autoPlay?: boolean;
    controls?: boolean;
    className?: string;
    onReady?: (durationSeconds: number) => void;
    onEnded?: () => void;
    onTimeUpdate?: (currentSeconds: number) => void;
    onError?: (message: string) => void;
    /** Fired on actual playback start/stop — drives watch-time tracking. */
    onPlay?: () => void;
    onPause?: () => void;
}

/** Parse HH:MM:SS / MM:SS / SS into seconds. Matches the existing item format. */
export function parseTimeToSeconds(value?: string): number | undefined {
    if (!value) return undefined;
    const parts = value.split(':').map(Number);
    if (parts.some(Number.isNaN)) return undefined;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 1) return parts[0];
    return undefined;
}

const HlsVideoPlayer = forwardRef<HlsPlayerHandle, HlsVideoPlayerProps>(
    function HlsVideoPlayer(
        {
            assetId,
            startTime,
            endTime,
            autoPlay = false,
            controls = true,
            className,
            onReady,
            onEnded,
            onTimeUpdate,
            onError,
            onPlay,
            onPause,
        },
        ref,
    ) {
        const videoRef = useRef<HTMLVideoElement | null>(null);
        const hlsRef = useRef<Hls | null>(null);
        /**
         * Position to restore after a mid-session reload. A grant expiring is a
         * fatal network error in hls.js, and recovering by reloading the source
         * would otherwise silently restart the lesson from zero.
         */
        const resumeAtRef = useRef<number>(0);
        const recoveringRef = useRef(false);

        const [loading, setLoading] = useState(true);
        const [error, setError] = useState<string | null>(null);

        const startSeconds = parseTimeToSeconds(startTime);
        const endSeconds = parseTimeToSeconds(endTime);

        /**
         * Callbacks and the seek target are held in refs so that neither a parent
         * passing inline handlers nor an edited timestamp can invalidate `load`.
         *
         * This matters: `load` tears down hls.js and fetches a fresh playback
         * grant, so if it were recreated whenever `startTime` changed, typing a
         * timestamp in the item editor would restart the video — and request a new
         * signed URL — on every keystroke.
         */
        const startSecondsRef = useRef(startSeconds);
        startSecondsRef.current = startSeconds;
        const onErrorRef = useRef(onError);
        onErrorRef.current = onError;

        const reportError = useCallback((message: string) => {
            setError(message);
            setLoading(false);
            onErrorRef.current?.(message);
        }, []);

        /**
         * Attach a freshly-signed playlist to the media element.
         *
         * Every load — first and recovery alike — goes through a new grant rather
         * than reusing a URL, because the previous one is usually the reason we
         * are here.
         */
        const load = useCallback(
            async (resumeAt?: number) => {
                const video = videoRef.current;
                if (!video) return;

                try {
                    const grant = await getVideoPlaybackUrl(assetId);

                    if (Hls.isSupported()) {
                        // Tear down any previous instance before re-attaching, or the
                        // old one keeps fetching segments against a dead URL.
                        hlsRef.current?.destroy();
                        const hls = new Hls({ enableWorker: true });
                        hlsRef.current = hls;

                        hls.on(Hls.Events.MANIFEST_PARSED, () => {
                            setLoading(false);
                            recoveringRef.current = false;
                            const seekTarget = resumeAt ?? startSecondsRef.current;
                            if (seekTarget) video.currentTime = seekTarget;
                            if (autoPlay) void video.play().catch(() => undefined);
                        });

                        hls.on(Hls.Events.ERROR, (_event, data) => {
                            if (!data.fatal) return;

                            if (
                                data.type === Hls.ErrorTypes.NETWORK_ERROR &&
                                !recoveringRef.current
                            ) {
                                // Most likely an expired grant. Re-sign and resume from
                                // where the learner actually was.
                                recoveringRef.current = true;
                                resumeAtRef.current = video.currentTime;
                                void load(resumeAtRef.current);
                                return;
                            }

                            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                                // Recoverable in place; hls.js can re-sync the buffer.
                                hls.recoverMediaError();
                                return;
                            }

                            reportError(
                                'Playback failed and could not be recovered. Please reload.',
                            );
                        });

                        hls.loadSource(grant.url);
                        hls.attachMedia(video);
                        return;
                    }

                    // Safari plays HLS natively; hls.js is unsupported there.
                    if (video.canPlayType('application/vnd.apple.mpegurl')) {
                        video.src = grant.url;
                        const seekTarget = resumeAt ?? startSecondsRef.current;
                        if (seekTarget) {
                            const seekOnce = () => {
                                video.currentTime = seekTarget;
                                video.removeEventListener('loadedmetadata', seekOnce);
                            };
                            video.addEventListener('loadedmetadata', seekOnce);
                        }
                        setLoading(false);
                        if (autoPlay) void video.play().catch(() => undefined);
                        return;
                    }

                    reportError('This browser cannot play HLS video.');
                } catch (err) {
                    reportError(
                        err instanceof Error
                            ? err.message
                            : 'Could not load this video.',
                    );
                }
            },
            [assetId, autoPlay, reportError],
        );

        useEffect(() => {
            setLoading(true);
            setError(null);
            recoveringRef.current = false;
            void load();

            return () => {
                hlsRef.current?.destroy();
                hlsRef.current = null;
            };
        }, [load]);

        /**
         * Reposition when the segment start changes — a seek, not a reload.
         *
         * Editing the start timestamp should move the preview, but tearing the
         * player down for it would restart the stream and burn a signed URL per
         * keystroke. Skipped while playing so it cannot yank a learner backwards.
         */
        useEffect(() => {
            const video = videoRef.current;
            if (!video || loading || startSeconds === undefined) return;
            if (!video.paused) return;
            if (Math.abs(video.currentTime - startSeconds) < 0.5) return;
            video.currentTime = startSeconds;
        }, [startSeconds, loading]);

        // Segment bounds: an item is a slice of a longer video, so stop at endTime
        // instead of playing on into the next lesson's content.
        useEffect(() => {
            const video = videoRef.current;
            if (!video) return;

            const handleTimeUpdate = () => {
                onTimeUpdate?.(video.currentTime);
                if (endSeconds !== undefined && video.currentTime >= endSeconds) {
                    video.pause();
                    onEnded?.();
                }
            };
            const handleEnded = () => onEnded?.();
            const handleLoadedMetadata = () => onReady?.(video.duration);
            const handlePlay = () => onPlay?.();
            const handlePause = () => onPause?.();

            video.addEventListener('timeupdate', handleTimeUpdate);
            video.addEventListener('ended', handleEnded);
            video.addEventListener('loadedmetadata', handleLoadedMetadata);
            video.addEventListener('play', handlePlay);
            video.addEventListener('pause', handlePause);
            return () => {
                video.removeEventListener('timeupdate', handleTimeUpdate);
                video.removeEventListener('ended', handleEnded);
                video.removeEventListener('loadedmetadata', handleLoadedMetadata);
                video.removeEventListener('play', handlePlay);
                video.removeEventListener('pause', handlePause);
            };
        }, [endSeconds, onEnded, onReady, onTimeUpdate, onPlay, onPause]);

        useImperativeHandle(
            ref,
            (): HlsPlayerHandle => ({
                playVideo: () => void videoRef.current?.play().catch(() => undefined),
                pauseVideo: () => videoRef.current?.pause(),
                seekTo: seconds => {
                    if (videoRef.current) videoRef.current.currentTime = seconds;
                },
                getCurrentTime: () => videoRef.current?.currentTime ?? 0,
                getDuration: () => videoRef.current?.duration ?? 0,
                getVolume: () => (videoRef.current?.volume ?? 0) * 100,
                setVolume: volume => {
                    if (videoRef.current) {
                        videoRef.current.volume = Math.min(Math.max(volume, 0), 100) / 100;
                    }
                },
                getPlaybackRate: () => videoRef.current?.playbackRate ?? 1,
                setPlaybackRate: rate => {
                    if (videoRef.current) videoRef.current.playbackRate = rate;
                },
            }),
            [],
        );

        return (
            <div className={className}>
                <video
                    ref={videoRef}
                    controls={controls}
                    playsInline
                    className="w-full h-full rounded-md bg-black"
                />
                {loading && !error && (
                    <p className="mt-2 text-sm text-muted-foreground">
                        Loading video…
                    </p>
                )}
                {error && (
                    <p className="mt-2 text-sm text-destructive" role="alert">
                        {error}
                    </p>
                )}
            </div>
        );
    },
);

export default HlsVideoPlayer;
