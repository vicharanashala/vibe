import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { Play, Pause, SkipBack, Volume2, ChevronRight } from 'lucide-react';
import { useStartItem, useStopItem } from '../hooks/hooks';
import { useAuthStore } from '../store/auth-store';
import { useCourseStore } from '../store/course-store';

interface VideoProps {
  URL: string;
  startTime?: string;
  endTime?: string;
  points?: string;
  doGesture?: boolean;
  onNext?: () => void;
  isProgressUpdating?: boolean;
}

// Helper to extract YouTube video ID from URL
function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:v=|youtu.be\/?)([\w-]{11})/);
  return match ? match[1] : null;
}

// Minimal YT namespace types for YouTube IFrame API
declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLDivElement,
        options: {
          videoId: string;
          playerVars: Record<string, unknown>;
          events: {
            onReady: (event: { target: YTPlayerInstance }) => void;
            onStateChange: (event: { data: number; target: YTPlayerInstance }) => void;
          };
        }
      ) => YTPlayerInstance;
      PlayerState: { PLAYING: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getVolume: () => number;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  getAvailablePlaybackRates?: () => number[];
}

// Helper to parse time string (HH:MM:SS or MM:SS or SS) to seconds
function parseTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]; // HH:MM:SS
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1]; // MM:SS
  } else {
    return parts[0] || 0; // SS
  }
}

export default function Video({ URL, startTime, endTime, points, doGesture = false, onNext, isProgressUpdating }: VideoProps) {
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const iframeRef = useRef<HTMLDivElement>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [maxTime, setMaxTime] = useState(0);
  const [, setIsHovering] = useState(false);
  const videoId = getYouTubeId(URL);
  const userId = useAuthStore((state) => state.user?.userId);
  const { currentCourse, setWatchItemId } = useCourseStore();
  const startItem = useStartItem();
  const stopItem = useStopItem();

  // Parse start and end times
  const startTimeSeconds = parseTimeToSeconds(startTime || '0');
  const endTimeSeconds = parseTimeToSeconds(endTime || '');

  const progressStartedRef = useRef(false);
  const progressStoppedRef = useRef(false);
  const watchItemIdRef = useRef<string | null>(null);

  // Track if video was playing before gesture pause
  const wasPlayingBeforeGesture = useRef(false);

  // Control handlers
  const handlePlayPause = useCallback(() => {
    const player = playerRef.current;
    if (!player || typeof player.pauseVideo !== 'function') return;
    if (playing) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  }, [playing]);

  const handleBackward = () => {
    const player = playerRef.current;
    if (!player) return;
    const newTime = Math.max(startTimeSeconds, currentTime - 10);
    player.seekTo(newTime, true);
  };

  // Pause/resume video based on doGesture
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (doGesture) {
      // Pause and remember if it was playing
      if (playing) {
        wasPlayingBeforeGesture.current = true;
        player.pauseVideo();
      } else {
        wasPlayingBeforeGesture.current = false;
      }
    } else {
      // Resume if it was playing before gesture
      if (wasPlayingBeforeGesture.current) {
        player.playVideo();
        wasPlayingBeforeGesture.current = false;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doGesture]);

  function handleSendStartItem() {
    if (!userId || !currentCourse?.itemId) return;
    startItem.mutate({
      params: {
        path: {
          userId,
          courseId: currentCourse.courseId,
          courseVersionId: currentCourse.versionId ?? '',
        },
      },
      body: {
        itemId: currentCourse.itemId,
        moduleId: currentCourse.moduleId ?? '',
        sectionId: currentCourse.sectionId ?? '',
      }
    });
  }

  // Update watchItemId when startItem succeeds
  useEffect(() => {
    if (startItem.data?.watchItemId) {
      watchItemIdRef.current = startItem.data.watchItemId;
      setWatchItemId(startItem.data.watchItemId);
    }
  }, [startItem.data?.watchItemId, setWatchItemId]);

  // Load YouTube IFrame API
  useEffect(() => {
    function createPlayer() {
      if (!iframeRef.current || !videoId) return;
      playerRef.current = new window.YT!.Player(iframeRef.current, {
        videoId,
        playerVars: {
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          fs: 0,
          iv_load_policy: 3,
          cc_load_policy: 0,
          autohide: 1,
          showinfo: 0,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
          widget_referrer: window.location.origin,
          start: startTimeSeconds,
          end: 0,
          loop: 0,
          autoplay: 0,
        },
        events: {
          onReady: (event: { target: YTPlayerInstance }) => {
            setPlayerReady(true);
            setDuration(event.target.getDuration());
            setVolume(event.target.getVolume());
            setMaxTime(startTimeSeconds);
            event.target.seekTo(startTimeSeconds, true);
          },
          onStateChange: (event: { data: number; target: YTPlayerInstance }) => {
            if (window.YT && event.data === window.YT.PlayerState.PLAYING) {
              setPlaying(true);
              if (!progressStartedRef.current) {
                handleSendStartItem();
                progressStartedRef.current = true;
              }
            } else {
              setPlaying(false);
            }
          },
        },
      });
    }
    if (window.YT && window.YT.Player) {
      createPlayer();
    } else {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
      window.onYouTubeIframeAPIReady = createPlayer;
    }

    // Cleanup when component unmounts or URL changes
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy?.();
        playerRef.current = null;
      }
    };
  }, [videoId, startTimeSeconds]);

  // Handle keyboard events including space for play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle space key for play/pause
      if (e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        handlePlayPause();
        return;
      }

      const blockedKeys = [
        'KeyK', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
        'KeyM', 'KeyF', 'KeyT', 'KeyC', 'Digit0', 'Digit1', 'Digit2', 'Digit3',
        'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9',
        'Period', 'Comma', 'KeyI', 'KeyO',
      ];

      if (blockedKeys.includes(e.code) ||
        (e.shiftKey && e.code === 'Period') ||
        (e.shiftKey && e.code === 'Comma')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handlePlayPause]);

  // Poll current time and enforce time constraints
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (playerReady) {
      interval = setInterval(() => {
        const player = playerRef.current;
        if (player && player.getCurrentTime) {
          const time = player.getCurrentTime();
          setCurrentTime(time);
          setDuration(player.getDuration());
          setVolume(player.getVolume());

          // Enforce startTime constraint
          if (time < startTimeSeconds) {
            player.seekTo(startTimeSeconds, true);
            setMaxTime(startTimeSeconds);
            return;
          }

          // Enforce endTime constraint
          if (endTimeSeconds > 0 && !progressStoppedRef.current && time >= endTimeSeconds - 1) {
            const watchItemId = watchItemIdRef.current || currentCourse.watchItemId;
            console.log({params: {
                  path: {
                    userId,
                    courseId: currentCourse.courseId,
                    courseVersionId: currentCourse.versionId ?? '',
                  },
                },
                body: {
                  watchItemId,
                  itemId: currentCourse.itemId,
                  moduleId: currentCourse.moduleId ?? '',
                  sectionId: currentCourse.sectionId ?? '',
                }});

            if (watchItemId && userId) {
              stopItem.mutate({
                params: {
                  path: {
                    userId,
                    courseId: currentCourse.courseId,
                    courseVersionId: currentCourse.versionId ?? '',
                  },
                },
                body: {
                  watchItemId,
                  itemId: currentCourse.itemId,
                  moduleId: currentCourse.moduleId ?? '',
                  sectionId: currentCourse.sectionId ?? '',
                }
              });
            }
            progressStoppedRef.current = true;
          }
          if (endTimeSeconds > 0 && time >= endTimeSeconds) {
            player.pauseVideo();
            player.seekTo(endTimeSeconds, true);
            setMaxTime(endTimeSeconds);
            return;
          }

          // Prevent forward seeking beyond what they've already watched
          const speedTolerance = playbackRate * 1.0;
          const timeDifference = time - maxTime;

          if (timeDifference > speedTolerance + 1.0 && time <= endTimeSeconds) {
            player.seekTo(maxTime, true);
          } else if (time >= startTimeSeconds && time <= endTimeSeconds) {
            setMaxTime(Math.max(maxTime, time));
          }
        }
      }, Math.max(200, 500 / playbackRate));
    }
    return () => clearInterval(interval);
  }, [playerReady, maxTime, playbackRate, startTimeSeconds, endTimeSeconds]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'hsl(var(--background))',
        overflow: 'hidden',
        padding: '16px',
        boxSizing: 'border-box',
        cursor: 'pointer',
      }}
      onClick={handlePlayPause}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div style={{
        width: '100%',
        height: '100%',
        maxWidth: '100%',
        maxHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '12px',
        overflow: 'hidden',
      }}>
        {/* Video Container */}
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          <div
            ref={iframeRef}
            style={{
              width: '100%',
              height: '100%',
              background: 'hsl(var(--background))',
              borderRadius: '12px 12px 0 0',
              overflow: 'hidden',
              pointerEvents: 'none',
              position: 'relative',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              MozUserSelect: 'none',
              msUserSelect: 'none',
            }}
          />

          {/* Multiple overlay layers to block YouTube controls */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'transparent',
              pointerEvents: 'auto',
              zIndex: 10,
              userSelect: 'none',
              WebkitUserSelect: 'none',
              MozUserSelect: 'none',
              msUserSelect: 'none',
              cursor: 'pointer',
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handlePlayPause();
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onKeyDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            tabIndex={-1}
          />

          {/* Additional security overlay */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.001)',
              pointerEvents: 'auto',
              zIndex: 9,
            }}
            onContextMenu={(e) => e.preventDefault()}
            onDoubleClick={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
            onMouseUp={(e) => e.preventDefault()}
            onTouchStart={(e) => e.preventDefault()}
            onTouchEnd={(e) => e.preventDefault()}
          />
        </div>

        {/* Custom Controls Below Video */}
        <div
          style={{
            background: 'hsl(var(--card))',
            padding: '8px 16px',
            borderTop: '1px solid hsl(var(--primary) / 0.2)',
            borderRadius: '0 0 12px 12px',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none',
            flexShrink: 0,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress Bar - Visual indicator only, no seeking */}
          <div style={{ marginBottom: 8 }}>
            <Slider
              value={[currentTime]}
              min={startTimeSeconds}
              max={endTimeSeconds > 0 ? endTimeSeconds : duration}
              step={0.1}
              onValueChange={() => {
                // Disabled - no seeking allowed
              }}
              className="w-full pointer-events-none"
              disabled
            />
          </div>

          {/* Control Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap'
          }}>
            {/* Left Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayPause();
                }}
                size="icon"
                variant={playing ? "default" : "secondary"}
                className="rounded-full w-9 h-9 flex-shrink-0"
                aria-label={playing ? 'Pause' : 'Play'}
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>

              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleBackward();
                }}
                size="icon"
                variant="secondary"
                className="rounded-full w-8 h-8 flex-shrink-0"
                aria-label="Back 10 seconds"
              >
                <SkipBack className="h-3 w-3" />
              </Button>

              <span style={{
                color: 'hsl(var(--foreground))',
                fontFamily: 'var(--font-sans)',
                fontSize: 12,
                fontWeight: 500,
                minWidth: 80,
                textShadow: '0 1px 3px hsl(var(--background) / 0.5)',
                flexShrink: 0
              }}>
                {formatTime(Math.max(startTimeSeconds, currentTime))} / {formatTime(endTimeSeconds > 0 ? endTimeSeconds : duration)}
              </span>
            </div>

            {/* Right Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              {/* Speed Control */}
              <Card className="flex flex-row items-center gap-1.5 px-2 py-1.5 bg-accent/15 flex-shrink-0">
                <span className="text-xs font-medium text-foreground min-w-[24px]">
                  Speed
                </span>
                <Slider
                  value={[playbackRate]}
                  min={0.25}
                  max={2}
                  step={0.05}
                  onValueChange={(value) => {
                    const rate = value[0];
                    setPlaybackRate(rate);
                    const player = playerRef.current;
                    if (player && typeof player.getAvailablePlaybackRates === 'function') {
                      const availableRates = player.getAvailablePlaybackRates!();
                      let closest = availableRates[0];
                      for (const r of availableRates) {
                        if (Math.abs(r - rate) < Math.abs(closest - rate)) closest = r;
                      }
                      player.setPlaybackRate(closest);
                      setPlaybackRate(closest);
                    } else {
                      playerRef.current?.setPlaybackRate(rate);
                    }
                  }}
                  className="w-[50px]"
                />
                <span className="text-xs font-semibold text-primary min-w-[24px] text-center">
                  {playbackRate.toFixed(2)}x
                </span>
              </Card>

              {/* Volume Control */}
              <Card className="flex flex-row items-center gap-1.5 px-2 py-1.5 bg-accent/15 flex-shrink-0">
                <Volume2 className="h-3 w-3 text-accent flex-shrink-0" />
                <Slider
                  value={[volume]}
                  min={0}
                  max={100}
                  onValueChange={(value) => {
                    const v = value[0];
                    setVolume(v);
                    playerRef.current?.setVolume(v);
                  }}
                  className="w-[40px]"
                />
                <span className="text-xs font-medium text-foreground min-w-[24px] text-center">
                  {Math.round(volume)}%
                </span>
              </Card>
            </div>
          </div>

          {/* Next Lesson Button */}
          {onNext && (
            <div style={{
              borderTop: '1px solid hsl(var(--border))',
              paddingTop: '12px',
              marginTop: '12px',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onNext();
                }}
                disabled={isProgressUpdating}
                className="shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground border-0"
                size="lg"
              >
                {isProgressUpdating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground mr-2" />
                    Processing
                  </>
                ) : (
                  <>
                    Next Lesson
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Global CSS to block YouTube interface */}
      <style>{`
        iframe[src*="youtube.com"] {
          pointer-events: none !important;
        }
        
        /* Hide any YouTube branding or controls that might appear */
        .ytp-chrome-top,
        .ytp-chrome-bottom,
        .ytp-gradient-top,
        .ytp-gradient-bottom,
        .ytp-progress-bar-container,
        .ytp-chrome-controls,
        .ytp-title,
        .ytp-watermark,
        .ytp-menuitem,
        .ytp-popup,
        .ytp-settings-menu,
        .ytp-panel,
        .annotation,
        .video-annotations,
        .ytp-cards-teaser,
        .ytp-ce-element {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
        
        /* Block right-click on the entire video area */
        .video-container * {
          -webkit-touch-callout: none !important;
          -webkit-user-select: none !important;
          -khtml-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          user-select: none !important;
        }
      `}</style>
    </div>
  );
}