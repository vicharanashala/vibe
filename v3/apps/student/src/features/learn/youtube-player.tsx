import {
  MaximizeIcon,
  MinimizeIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  RotateCwIcon,
  Volume2Icon,
  VolumeXIcon,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

/* Minimal typings for the bits of the YouTube IFrame API we use. */
interface YTPlayer {
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  setPlaybackRate(rate: number): void;
  mute(): void;
  unMute(): void;
  destroy(): void;
}
interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      playerVars: Record<string, number | string>;
      events: { onStateChange?: (e: { data: number }) => void; onReady?: () => void; onError?: (e: { data: number }) => void };
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
 * YouTube's own UI is switched off and nothing inside the embed can be clicked:
 * no controls, keyboard shortcuts, fullscreen button, related videos or
 * annotations, and the app draws its own controls instead.
 */
export const PLAYER_VARS = {
  controls: 0,
  disablekb: 1,
  fs: 0,
  rel: 0,
  iv_load_policy: 3,
  modestbranding: 1,
  playsinline: 1,
} as const;

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const SKIP_SECONDS = 10;
/** How long Play may take before we say the video didn't start. */
const START_TIMEOUT_MS = 8000;

/**
 * Our words for YouTube's error codes. YouTube's own error screen is under the
 * cover (it carries a "Watch on YouTube" link), so the player says it instead.
 */
export function youTubeErrorMessage(code: number): string {
  // YouTube also uses 150 when it wants the viewer to prove they aren't a bot,
  // so this can't blame the video's owner.
  if (code === 101 || code === 150 || code === 152 || code === 153)
    return 'YouTube won’t play this video here right now. Try again later, or tell your instructor if it keeps happening.';
  if (code === 100) return 'This video is no longer available on YouTube.';
  return 'YouTube couldn’t play this video.';
}

/**
 * Where a seek to `target` (seconds in the video) may land: inside the clip,
 * and — when seeking forward isn't allowed — no further than the furthest
 * point already watched. Seeking backward is always allowed.
 */
export function clampSeek(
  target: number,
  { start, end, furthest, allowSeekForward }: { start: number; end: number; furthest: number; allowSeekForward: boolean },
): number {
  const upper = end > start ? end : Number.POSITIVE_INFINITY;
  let t = Math.min(Math.max(target, start), upper);
  if (!allowSeekForward) t = Math.min(t, Math.max(furthest, start));
  return t;
}

/** 75 → "1:15", 3725 → "1:02:05". */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/**
 * Plays [start, end] of a YouTube video with the app's own controls. When
 * seeking forward is not allowed (strict mode), seeks past the furthest point
 * already watched are held back; study mode passes `allowSeekForward` and
 * seeks freely both ways. Reports playing state and the end of the clip.
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
  /** Forces the video to pause (e.g. while a proctoring check is blocking). */
  paused?: boolean;
  videoId: string;
  start: number;
  end: number;
  allowSeekForward: boolean;
  onPlayingChange?: (playing: boolean) => void;
  onEnded?: () => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const callbacks = useRef({ onPlayingChange, onEnded });
  callbacks.current = { onPlayingChange, onEnded };
  const furthestRef = useRef(start);
  const draggingRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(start);
  const [furthest, setFurthest] = useState(start);
  const [clipEnd, setClipEnd] = useState(end > start ? end : start);
  const [rate, setRate] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const startTimer = useRef(0);

  useEffect(() => {
    let player: YTPlayer | null = null;
    let poll = 0;
    let cancelled = false;
    furthestRef.current = start;
    setReady(false);
    setPlaying(false);
    setCurrent(start);
    setFurthest(start);
    setProblem(null);

    void loadYouTubeApi().then((YT) => {
      if (cancelled || !hostRef.current) return;
      const mount = document.createElement('div');
      hostRef.current.replaceChildren(mount);
      player = new YT.Player(mount, {
        videoId,
        playerVars: { ...PLAYER_VARS, start, ...(end > start ? { end } : {}) },
        events: {
          onReady: () => {
            setReady(true);
            const duration = player?.getDuration?.() ?? 0;
            setClipEnd(end > start ? end : Math.max(duration, start));
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PLAYING && pausedRef.current) player?.pauseVideo();
            const isPlaying = e.data === YT.PlayerState.PLAYING;
            if (isPlaying) {
              window.clearTimeout(startTimer.current);
              setProblem(null);
            }
            setPlaying(isPlaying);
            callbacks.current.onPlayingChange?.(isPlaying);
            if (e.data === YT.PlayerState.ENDED) callbacks.current.onEnded?.();
          },
          onError: (e) => {
            window.clearTimeout(startTimer.current);
            setProblem(youTubeErrorMessage(e.data));
          },
        },
      });
      playerRef.current = player;
      poll = window.setInterval(() => {
        if (!player) return;
        const t = player.getCurrentTime?.() ?? 0;
        if (!allowSeekForward && t > furthestRef.current + 2) {
          player.seekTo(furthestRef.current, true);
          return;
        }
        furthestRef.current = Math.max(furthestRef.current, t);
        setFurthest(furthestRef.current);
        if (!draggingRef.current) setCurrent(t);
        if (end > start && t >= end - 0.25) {
          player.pauseVideo();
          callbacks.current.onEnded?.();
        }
      }, 250);
    });

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.clearTimeout(startTimer.current);
      player?.destroy();
      playerRef.current = null;
    };
  }, [videoId, start, end, allowSeekForward]);

  useEffect(() => {
    if (paused) playerRef.current?.pauseVideo?.();
  }, [paused]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const limits = { start, end: clipEnd, furthest, allowSeekForward };
  const seek = useCallback(
    (target: number) => {
      const t = clampSeek(target, { start, end: clipEnd, furthest: furthestRef.current, allowSeekForward });
      playerRef.current?.seekTo(t, true);
      setCurrent(t);
    },
    [start, clipEnd, allowSeekForward],
  );

  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player || !ready) return;
    if (playing) {
      player.pauseVideo();
      return;
    }
    if (pausedRef.current) return;
    // At the end of the clip, play starts it again.
    if (clipEnd > start && current >= clipEnd - 0.5) player.seekTo(start, true);
    setProblem(null);
    player.playVideo();
    // YouTube can refuse silently (e.g. a "confirm you're not a bot" check),
    // which the cover would hide; say so instead of leaving Play doing nothing.
    window.clearTimeout(startTimer.current);
    startTimer.current = window.setTimeout(
      () => setProblem('The video didn’t start. Check your connection and try again.'),
      START_TIMEOUT_MS,
    );
  }, [ready, playing, clipEnd, start, current]);

  const toggleMute = () => {
    const player = playerRef.current;
    if (!player) return;
    if (muted) player.unMute();
    else player.mute();
    setMuted(!muted);
  };

  const changeRate = (value: number) => {
    playerRef.current?.setPlaybackRate(value);
    setRate(value);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void frameRef.current?.requestFullscreen?.();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return; // let focused controls handle their own keys
    if (e.key === ' ' || e.key === 'k') togglePlay();
    else if (e.key === 'ArrowLeft') seek(current - 5);
    else if (e.key === 'ArrowRight') seek(current + 5);
    else if (e.key === 'm') toggleMute();
    else if (e.key === 'f') toggleFullscreen();
    else return;
    e.preventDefault();
  };

  const length = Math.max(clipEnd - start, 0);
  const canSkipForward = clampSeek(current + SKIP_SECONDS, limits) > current + 0.5;

  return (
    <div
      ref={frameRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label="Video player"
      className={cn(
        'group/player overflow-hidden rounded-2xl bg-black outline-none focus-visible:ring-2 focus-visible:ring-ring',
        fullscreen && 'flex flex-col justify-center rounded-none',
      )}
    >
      <div className="relative aspect-video w-full">
        <div ref={hostRef} className="absolute inset-0 [&_iframe]:size-full" />
        {/* Covers the embed so nothing inside YouTube (title, channel, "Watch on
            YouTube", related videos) can be hovered or clicked. */}
        <div
          data-testid="player-shield"
          className="absolute inset-0 z-10 cursor-pointer"
          onClick={togglePlay}
          aria-hidden
        />
        {!playing && (
          // YouTube shows its title and links whenever the video isn't playing,
          // so the thumbnail and our play button cover it then.
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center">
            <img
              src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
              alt=""
              className="absolute inset-0 size-full object-cover"
              draggable={false}
            />
            <div className={cn('absolute inset-0', problem ? 'bg-black/70' : 'bg-black/30')} />
            {problem && (
              <p role="alert" className="relative mx-6 mb-3 max-w-sm text-center text-sm text-white">
                {problem}
              </p>
            )}
            <Button
              size="icon-lg"
              className="relative size-16 rounded-full shadow-lg"
              onClick={togglePlay}
              disabled={!ready || paused}
              aria-label={problem ? 'Try again' : 'Play'}
            >
              <PlayIcon className="size-7 fill-current" aria-hidden />
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-1 gap-y-2 bg-card px-2 py-2 text-card-foreground sm:flex-nowrap">
        <Button variant="ghost" size="icon" onClick={togglePlay} disabled={!ready || (paused && !playing)} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <PauseIcon aria-hidden /> : <PlayIcon aria-hidden />}
        </Button>
        <Button variant="ghost" size="icon" onClick={() => seek(current - SKIP_SECONDS)} disabled={!ready} aria-label={`Back ${SKIP_SECONDS} seconds`}>
          <RotateCcwIcon aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => seek(current + SKIP_SECONDS)}
          disabled={!ready || !canSkipForward}
          aria-label={`Forward ${SKIP_SECONDS} seconds`}
        >
          <RotateCwIcon aria-hidden />
        </Button>
        <span className="shrink-0 px-1 text-xs tabular-nums text-muted-foreground">
          {formatTime(current - start)} / {formatTime(length)}
        </span>
        <Slider
          className="order-last mx-2 basis-full sm:order-none sm:basis-auto sm:flex-1"
          aria-label="Seek"
          min={0}
          max={length || 1}
          step={1}
          value={[Math.min(Math.max(current - start, 0), length)]}
          disabled={!ready || length === 0}
          onValueChange={(v) => {
            draggingRef.current = true;
            const value = Array.isArray(v) ? v[0] : v;
            setCurrent(clampSeek(start + value, { ...limits, furthest: furthestRef.current }));
          }}
          onValueCommitted={(v) => {
            draggingRef.current = false;
            seek(start + (Array.isArray(v) ? v[0] : v));
          }}
        />
        <div className="ml-auto flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="tabular-nums" aria-label="Playback speed" disabled={!ready} />}>
              {rate}×
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-28">
              <DropdownMenuRadioGroup value={String(rate)} onValueChange={(v) => changeRate(Number(v))}>
                {SPEEDS.map((s) => (
                  <DropdownMenuRadioItem key={s} value={String(s)} closeOnClick>
                    {s}×
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" onClick={toggleMute} disabled={!ready} aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeXIcon aria-hidden /> : <Volume2Icon aria-hidden />}
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}>
            {fullscreen ? <MinimizeIcon aria-hidden /> : <MaximizeIcon aria-hidden />}
          </Button>
        </div>
      </div>
    </div>
  );
}
