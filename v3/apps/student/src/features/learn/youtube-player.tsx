import {
  CaptionsIcon,
  CaptionsOffIcon,
  EyeIcon,
  EyeOffIcon,
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
  getAvailableQualityLevels?(): string[];
  setPlaybackQuality?(quality: string): void;
  mute(): void;
  unMute(): void;
  destroy(): void;
  /** Captions are a player module: loaded = shown, unloaded = hidden. */
  loadModule?(name: 'captions'): void;
  unloadModule?(name: 'captions'): void;
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
  PlayerState: { ENDED: 0; PLAYING: 1; PAUSED: 2; BUFFERING?: 3 };
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
  // Captions start off whatever the viewer's YouTube settings say; the CC
  // button turns them on.
  cc_load_policy: 0,
} as const;

/**
 * The embed is taller than the visible frame by this much at the top and the
 * bottom. YouTube fits the video to the visible part and draws its title row
 * (title, share, watch later) and its logo in the cropped strips, so they
 * never show, even for the few seconds after playback starts.
 */
export const CROP_PX = 72;

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

/**
 * The quality menu's choices, in YouTube's names. YouTube has ignored
 * setPlaybackQuality since 2019 and still picks the quality itself, so today
 * this menu only asks. It's kept so the control is in place if that changes,
 * or for a player that honours it.
 */
export const QUALITIES = [
  { value: 'auto', label: 'Auto' },
  { value: 'hd1080', label: '1080p' },
  { value: 'hd720', label: '720p' },
  { value: 'large', label: '480p' },
  { value: 'medium', label: '360p' },
  { value: 'small', label: '240p' },
] as const;

/** Only what the video reports, or every choice when it reports nothing. */
export function qualityOptions(available: readonly string[]) {
  return QUALITIES.filter((q) => q.value === 'auto' || available.length === 0 || available.includes(q.value));
}

const SKIP_SECONDS = 10;
/** How long Play may take before we check what YouTube is doing. */
export const START_TIMEOUT_MS = 8000;
/** How long a video may keep loading (buffering) before we blame the connection. */
export const SLOW_LOAD_MS = 30000;
const BUFFERING = 3;

/**
 * Our words for YouTube's error codes, each with what the student can do and
 * the code for support. YouTube's own error screen sits under the cover; the
 * player offers to show it, since some of these need the student to act there.
 */
export function youTubeErrorMessage(code: number): string {
  switch (code) {
    case 2:
      return `This video’s link or start and end times aren’t valid, so YouTube won’t play it. Tell your course team. (YouTube error ${code})`;
    case 5:
      return `Your browser couldn’t play this video (YouTube error ${code}). Try again. If it keeps happening, reload the page, turn off ad blockers or other extensions for this site, or try another browser.`;
    case 100:
      return `This video is no longer available on YouTube. Tell your course team. (YouTube error ${code})`;
    case 101:
    case 150:
      // YouTube also uses these when it wants the viewer to sign in or prove
      // they aren't a bot, so this can't simply blame the video's owner.
      return `YouTube won’t play this video inside ViBe (YouTube error ${code}). The owner may not allow it, or YouTube wants you to sign in or confirm you’re not a bot. Show YouTube’s message to see which, or try another browser.`;
    case 152:
    case 153:
      return `YouTube couldn’t tell which site is playing the video (YouTube error ${code}). A privacy extension or browser setting that hides the site you’re on usually causes this. Turn it off for this site and reload, or try another browser.`;
    default:
      return `YouTube couldn’t play this video (YouTube error ${code}). Try again, reload the page, or try another browser.`;
  }
}

/** Play got no response at all: not a connection problem, YouTube is holding it back. */
export const NO_START_MESSAGE =
  'YouTube didn’t start the video. It may be asking you to sign in or confirm something, or an extension may be blocking it. Show YouTube’s message to see, or try again.';
export const SLOW_LOAD_MESSAGE = 'The video is taking a long time to load. Check your connection, then try again.';
export const OFFLINE_MESSAGE = 'You’re offline. Check your connection, then try again.';

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
  const [quality, setQuality] = useState('auto');
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [captions, setCaptions] = useState(false);
  const captionsRef = useRef(false);
  captionsRef.current = captions;
  const [problem, setProblem] = useState<string | null>(null);
  const [loadingSlowly, setLoadingSlowly] = useState(false);
  /** After a failure: lift the cover so YouTube's own message (and any sign-in or check) can be seen and used. */
  const [reveal, setReveal] = useState(false);
  /** Bumped by Try again: recreates the player from scratch. */
  const [attempt, setAttempt] = useState(0);
  const playWhenReady = useRef(false);
  const stateRef = useRef(-1);
  const startTimer = useRef(0);

  /**
   * Asks YouTube to play, then checks on it. Buffering means it is loading:
   * give it longer before blaming the connection. No response at all is not a
   * connection problem: YouTube is holding it back (a sign-in or bot check, or
   * an extension blocking it), which the cover would otherwise hide.
   */
  const startPlayback = useRef<() => void>(() => undefined);
  startPlayback.current = () => {
    const player = playerRef.current;
    if (!player) return;
    setProblem(null);
    setLoadingSlowly(false);
    player.playVideo();
    window.clearTimeout(startTimer.current);
    startTimer.current = window.setTimeout(() => {
      if (stateRef.current === 1) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return setProblem(OFFLINE_MESSAGE);
      if (stateRef.current !== BUFFERING) return setProblem(NO_START_MESSAGE);
      setLoadingSlowly(true);
      startTimer.current = window.setTimeout(() => {
        setLoadingSlowly(false);
        if (stateRef.current !== 1) setProblem(SLOW_LOAD_MESSAGE);
      }, SLOW_LOAD_MS - START_TIMEOUT_MS);
    }, START_TIMEOUT_MS);
  };

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
    setLoadingSlowly(false);
    setReveal(false);
    setQuality('auto');
    setAvailableQualities([]);
    stateRef.current = -1;

    void loadYouTubeApi().then((YT) => {
      if (cancelled || !hostRef.current) return;
      const mount = document.createElement('div');
      hostRef.current.replaceChildren(mount);
      player = new YT.Player(mount, {
        videoId,
        // Whole seconds: YouTube's start and end take integers.
        playerVars: { ...PLAYER_VARS, start: Math.floor(start), ...(end > start ? { end: Math.ceil(end) } : {}) },
        events: {
          onReady: () => {
            setReady(true);
            const duration = player?.getDuration?.() ?? 0;
            setClipEnd(end > start ? end : Math.max(duration, start));
            if (playWhenReady.current) {
              playWhenReady.current = false;
              startPlayback.current();
            }
          },
          onStateChange: (e) => {
            stateRef.current = e.data;
            if (e.data === YT.PlayerState.PLAYING && pausedRef.current) player?.pauseVideo();
            const isPlaying = e.data === YT.PlayerState.PLAYING;
            if (isPlaying) {
              window.clearTimeout(startTimer.current);
              setProblem(null);
              setLoadingSlowly(false);
              setReveal(false);
              setAvailableQualities(player?.getAvailableQualityLevels?.() ?? []);
              // YouTube may switch captions on by itself when playback starts.
              if (!captionsRef.current) player?.unloadModule?.('captions');
            }
            setPlaying(isPlaying);
            callbacks.current.onPlayingChange?.(isPlaying);
            if (e.data === YT.PlayerState.ENDED) callbacks.current.onEnded?.();
          },
          onError: (e) => {
            window.clearTimeout(startTimer.current);
            setLoadingSlowly(false);
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
  }, [videoId, start, end, allowSeekForward, attempt]);

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

  /** Try again after a failure: a fresh player, which starts as soon as it's ready. */
  const retry = useCallback(() => {
    if (pausedRef.current) return;
    playWhenReady.current = true;
    setAttempt((n) => n + 1);
  }, []);

  const togglePlay = useCallback(() => {
    const player = playerRef.current;
    if (problem) return retry();
    if (!player || !ready) return;
    if (playing) {
      player.pauseVideo();
      return;
    }
    if (pausedRef.current) return;
    // At the end of the clip, play starts it again.
    if (clipEnd > start && current >= clipEnd - 0.5) player.seekTo(start, true);
    startPlayback.current();
  }, [ready, playing, clipEnd, start, current, problem, retry]);

  const toggleCaptions = () => {
    const player = playerRef.current;
    if (!player) return;
    if (captions) player.unloadModule?.('captions');
    else player.loadModule?.('captions');
    setCaptions(!captions);
  };

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

  const changeQuality = (value: string) => {
    playerRef.current?.setPlaybackQuality?.(value);
    setQuality(value);
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
    else if (e.key === 'c') toggleCaptions();
    else if (e.key === 'f') toggleFullscreen();
    else return;
    e.preventDefault();
  };

  const length = Math.max(clipEnd - start, 0);
  const qualities = qualityOptions(availableQualities);
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
      <div className="relative aspect-video w-full overflow-hidden">
        <div
          ref={hostRef}
          className="absolute inset-x-0 [&_iframe]:size-full"
          style={reveal ? { top: 0, bottom: 0 } : { top: -CROP_PX, bottom: -CROP_PX }}
        />
        {/* Covers the embed so nothing inside YouTube (title, channel, "Watch on
            YouTube", related videos) can be hovered or clicked. Lifted only
            after a failure, when the student asks to see YouTube's message. */}
        {!reveal && (
          <div
            data-testid="player-shield"
            className="absolute inset-0 z-10 cursor-pointer"
            onClick={togglePlay}
            aria-hidden
          />
        )}
        {!playing && !reveal && (
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
              <p role="alert" className="relative mx-6 mb-3 max-w-md text-center text-sm text-white">
                {problem}
              </p>
            )}
            {!problem && loadingSlowly && (
              <p role="status" className="relative mx-6 mb-3 max-w-sm text-center text-sm text-white">
                Still loading the video…
              </p>
            )}
            <Button
              size="icon-lg"
              className="relative size-16 rounded-full shadow-lg"
              onClick={togglePlay}
              disabled={problem ? paused : !ready || paused}
              aria-label={problem ? 'Try again' : 'Play'}
            >
              {problem ? <RotateCwIcon className="size-7" aria-hidden /> : <PlayIcon className="size-7 fill-current" aria-hidden />}
            </Button>
            {problem && (
              <Button variant="secondary" size="sm" className="relative mt-3" onClick={() => setReveal(true)}>
                <EyeIcon aria-hidden /> Show YouTube’s message
              </Button>
            )}
          </div>
        )}
      </div>
      {reveal && problem && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-card px-3 py-2 text-sm text-card-foreground">
          <p role="alert" className="min-w-0 flex-1">
            This is YouTube’s own player. Do what it asks (for example, sign in or confirm you’re not a bot), then try again.
          </p>
          <Button size="sm" onClick={retry} disabled={paused}>
            <RotateCwIcon aria-hidden /> Try again
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setReveal(false)}>
            <EyeOffIcon aria-hidden /> Hide
          </Button>
        </div>
      )}

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
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="tabular-nums" aria-label="Video quality" disabled={!ready} />}>
              {qualities.find((q) => q.value === quality)?.label ?? 'Auto'}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-28">
              <DropdownMenuRadioGroup value={quality} onValueChange={changeQuality}>
                {qualities.map((q) => (
                  <DropdownMenuRadioItem key={q.value} value={q.value} closeOnClick>
                    {q.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCaptions}
            disabled={!ready}
            aria-label={captions ? 'Turn subtitles off' : 'Turn subtitles on'}
            aria-pressed={captions}
          >
            {captions ? <CaptionsIcon aria-hidden /> : <CaptionsOffIcon aria-hidden />}
          </Button>
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
