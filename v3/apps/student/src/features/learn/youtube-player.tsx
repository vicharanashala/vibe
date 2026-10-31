import { useEffect, useRef } from 'react';

/* Minimal typings for the bits of the YouTube IFrame API we use. */
interface YTPlayer {
  getCurrentTime(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  pauseVideo(): void;
  destroy(): void;
}
interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      playerVars: Record<string, number | string>;
      events: { onStateChange?: (e: { data: number }) => void; onReady?: () => void };
    },
  ) => YTPlayer;
  PlayerState: { ENDED: 0; PLAYING: 1; PAUSED: 2 };
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;
function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT as YTNamespace);
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return apiPromise;
}

/**
 * Plays [start, end] of a YouTube video. When seeking forward is not allowed,
 * jumps past the furthest point already watched are snapped back (same rule as
 * the current player). Reports playing state and the end of the clip.
 */
export function YouTubePlayer({
  videoId,
  start,
  end,
  allowSeekForward,
  onPlayingChange,
  onEnded,
  paused = false,
}: {
  /** Forces the video to pause (e.g. while the camera is off on the blue track). */
  paused?: boolean;
  videoId: string;
  start: number;
  end: number;
  allowSeekForward: boolean;
  onPlayingChange?: (playing: boolean) => void;
  onEnded?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const callbacks = useRef({ onPlayingChange, onEnded });
  callbacks.current = { onPlayingChange, onEnded };

  useEffect(() => {
    let player: YTPlayer | null = null;
    let poll = 0;
    let furthest = start;
    let cancelled = false;

    void loadYouTubeApi().then((YT) => {
      if (cancelled || !hostRef.current) return;
      const mount = document.createElement('div');
      hostRef.current.replaceChildren(mount);
      player = new YT.Player(mount, {
        videoId,
        playerVars: { start, ...(end > start ? { end } : {}), rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PLAYING && pausedRef.current) player?.pauseVideo();
            callbacks.current.onPlayingChange?.(e.data === YT.PlayerState.PLAYING);
            if (e.data === YT.PlayerState.ENDED) callbacks.current.onEnded?.();
          },
        },
      });
      playerRef.current = player;
      poll = window.setInterval(() => {
        if (!player) return;
        const t = player.getCurrentTime?.() ?? 0;
        if (!allowSeekForward && t > furthest + 2) {
          player.seekTo(furthest, true);
          return;
        }
        furthest = Math.max(furthest, t);
        if (end > start && t >= end - 0.25) {
          player.pauseVideo();
          callbacks.current.onEnded?.();
        }
      }, 500);
    });

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      player?.destroy();
      playerRef.current = null;
    };
  }, [videoId, start, end, allowSeekForward]);

  useEffect(() => {
    if (paused) playerRef.current?.pauseVideo?.();
  }, [paused]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
      <div ref={hostRef} className="absolute inset-0 [&_iframe]:size-full" />
    </div>
  );
}
