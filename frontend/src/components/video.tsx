import React, { useEffect, useRef, useState } from 'react';

interface VideoProps {
  youtubeUrl: string;
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

const Video: React.FC<VideoProps> = ({ youtubeUrl }) => {
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

  const videoId = getYouTubeId(youtubeUrl);

  // Load YouTube IFrame API
  useEffect(() => {
    function createPlayer() {
      if (!iframeRef.current || !videoId) return;
      playerRef.current = new window.YT!.Player(iframeRef.current, {
        videoId,
        playerVars: {
          controls: 0, // Hide default controls
          disablekb: 1, // Disable keyboard controls
          modestbranding: 1,
          rel: 0,
          fs: 0, // Disable fullscreen
          iv_load_policy: 3, // Hide video annotations
          cc_load_policy: 0, // Hide closed captions
          autohide: 1, // Hide controls automatically
          showinfo: 0, // Hide video title and uploader
          playsinline: 1, // Play inline on mobile
          enablejsapi: 1, // Enable JS API
          origin: window.location.origin, // Set origin for security
          widget_referrer: window.location.origin, // Additional security
          start: 0, // Start from beginning
          end: 0, // No end time restriction
          loop: 0, // Don't loop
          autoplay: 0, // Don't autoplay
        },
        events: {
          onReady: (event: { target: YTPlayerInstance }) => {
            setPlayerReady(true);
            setDuration(event.target.getDuration());
            setVolume(event.target.getVolume());
          },
          onStateChange: (event: { data: number; target: YTPlayerInstance }) => {
            if (window.YT && event.data === window.YT.PlayerState.PLAYING) setPlaying(true);
            else setPlaying(false);
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
  }, [videoId]);

  // Block keyboard shortcuts globally when component is mounted
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block common YouTube keyboard shortcuts
      const blockedKeys = [
        'Space', // Play/pause
        'KeyK', // Play/pause
        'ArrowLeft', // Rewind
        'ArrowRight', // Fast forward
        'ArrowUp', // Volume up
        'ArrowDown', // Volume down
        'KeyM', // Mute
        'KeyF', // Fullscreen
        'KeyT', // Theater mode
        'KeyC', // Captions
        'Digit0', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 
        'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', // Seek to position
        'Period', 'Comma', // Frame by frame
        'KeyI', 'KeyO', // In/Out points
      ];

      if (blockedKeys.includes(e.code) || 
          (e.shiftKey && e.code === 'Period') || // Speed up
          (e.shiftKey && e.code === 'Comma')) { // Speed down
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  // Poll current time and prevent forward seeking
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
          
          // Prevent forward seeking - adjust tolerance based on playback speed
          const speedTolerance = playbackRate * 1.0; // Allow more tolerance at higher speeds
          const timeDifference = time - maxTime;
          
          // Only prevent seeking if the jump is significantly larger than expected for the current speed
          if (timeDifference > speedTolerance + 1.0) { // +1 second base tolerance
            player.seekTo(maxTime, true);
          } else {
            setMaxTime(Math.max(maxTime, time));
          }
        }
      }, Math.max(200, 500 / playbackRate)); // Adjust polling frequency based on speed
    }
    return () => clearInterval(interval);
  }, [playerReady, maxTime, playbackRate]); // Add playbackRate to dependencies

  // Control handlers
  const handlePlayPause = () => {
    const player = playerRef.current;
    if (!player) return;
    if (playing) player.pauseVideo();
    else player.playVideo();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setVolume(v);
    playerRef.current?.setVolume(v);
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rate = Number(e.target.value);
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
  };

  const handleBackward = () => {
    const player = playerRef.current;
    if (!player) return;
    const newTime = Math.max(0, currentTime - 10);
    player.seekTo(newTime, true);
  };

  // Prevent forward seeking via progress bar
  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = Number(e.target.value);
    if (seekTime <= maxTime) {
      playerRef.current?.seekTo(seekTime, true);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      style={{ 
        width: '100%', 
        height: '100vh', 
        position: 'relative', 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'hsl(var(--background))',
        overflow: 'hidden',
        padding: '3vh 5vw',
        boxSizing: 'border-box',
        cursor: 'pointer',
      }}
      onClick={handlePlayPause}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div style={{
        width: '100%',
        maxWidth: '1000px',
        height: '95vh',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '12px',
        overflow: 'hidden',
        // boxShadow: '0 6px 24px rgba(0, 0, 0, 0.2)',
      }}>
        {/* Video Container */}
        <div style={{ flex: 1, position: 'relative' }}>
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
              e.preventDefault(); // Block right-click context menu
              e.stopPropagation();
            }}
            onDoubleClick={(e) => {
              e.preventDefault(); // Block double-click fullscreen
              e.stopPropagation();
            }}
            onKeyDown={(e) => {
              e.preventDefault(); // Block any keyboard events
              e.stopPropagation();
            }}
            tabIndex={-1} // Remove from tab order
          />

          {/* Additional security overlay */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.001)', // Nearly invisible but blocks events
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
            padding: '12px 20px',
            borderTop: '1px solid hsl(var(--primary) / 0.2)',
            borderRadius: '0 0 12px 12px',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none',
          }}
          onClick={(e) => e.stopPropagation()} // Prevent play/pause when clicking controls
        >
          {/* Progress Bar */}
          <div style={{ marginBottom: 12 }}>
            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={currentTime}
              onChange={handleProgressChange}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                height: 5,
                borderRadius: 3,
                background: `linear-gradient(90deg, 
                  hsl(var(--primary)) 0%, 
                  hsl(var(--primary)) ${(currentTime / duration) * 100}%, 
                  hsl(var(--muted)) ${(currentTime / duration) * 100}%, 
                  hsl(var(--muted)) 100%)`,
                outline: 'none',
                cursor: 'pointer',
                appearance: 'none',
                WebkitAppearance: 'none',
              }}
            />
            <style>{`
              input[type="range"]::-webkit-slider-thumb {
                appearance: none;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: hsl(var(--primary));
                cursor: pointer;
                box-shadow: 0 2px 6px hsl(var(--primary) / 0.4);
                transition: all 0.2s ease;
              }
              input[type="range"]::-webkit-slider-thumb:hover {
                transform: scale(1.2);
                box-shadow: 0 4px 12px hsl(var(--primary) / 0.6);
              }
              input[type="range"]::-moz-range-thumb {
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: hsl(var(--primary));
                cursor: pointer;
                border: none;
                box-shadow: 0 2px 6px hsl(var(--primary) / 0.4);
              }
            `}</style>
          </div>

          {/* Control Bar */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            gap: 20 
          }}>
            {/* Left Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayPause();
                }}
                style={{
                  background: playing 
                    ? 'hsl(var(--primary))' 
                    : 'hsl(var(--muted))',
                  color: playing ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                  border: 'none',
                  borderRadius: '50%',
                  width: 42,
                  height: 42,
                  fontSize: 16,
                  cursor: 'pointer',
                  boxShadow: playing 
                    ? '0 3px 15px hsl(var(--primary) / 0.4)' 
                    : '0 3px 12px hsl(var(--muted) / 0.3)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(10px)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                aria-label={playing ? 'Pause' : 'Play'}
              >
                {playing ? '⏸' : '▶'}
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleBackward();
                }}
                style={{
                  background: 'hsl(var(--muted))',
                  color: 'hsl(var(--muted-foreground))',
                  border: 'none',
                  borderRadius: '50%',
                  width: 36,
                  height: 36,
                  fontSize: 14,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(10px)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'hsl(var(--accent))';
                  e.currentTarget.style.color = 'hsl(var(--accent-foreground))';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'hsl(var(--muted))';
                  e.currentTarget.style.color = 'hsl(var(--muted-foreground))';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                aria-label="Back 10 seconds"
              >
                ⏪
              </button>

              <span style={{ 
                color: 'hsl(var(--foreground))', 
                fontFamily: 'var(--font-sans)', 
                fontSize: 13,
                fontWeight: 500,
                minWidth: 90,
                textShadow: '0 1px 3px hsl(var(--background) / 0.5)'
              }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Right Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Speed Control */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 6,
                background: 'hsl(var(--accent) / 0.15)',
                padding: '6px 12px',
                borderRadius: 16,
                backdropFilter: 'blur(10px)',
              }}>
                <span style={{ 
                  color: 'hsl(var(--foreground))', 
                  fontSize: 11, 
                  fontWeight: 500,
                  minWidth: 30
                }}>
                  Speed
                </span>
                <input
                  type="range"
                  min={0.25}
                  max={2}
                  step={0.05}
                  value={playbackRate}
                  onChange={handleSpeedChange}
                  onClick={(e) => e.stopPropagation()}
                  style={{ 
                    accentColor: 'hsl(var(--primary))', 
                    width: 70,
                    height: 3,
                    borderRadius: 2,
                  }}
                />
                <span style={{ 
                  color: 'hsl(var(--primary))', 
                  fontSize: 11, 
                  fontWeight: 600,
                  minWidth: 28, 
                  textAlign: 'center'
                }}>
                  {playbackRate.toFixed(2)}x
                </span>
              </div>

              {/* Volume Control */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 6,
                background: 'hsl(var(--accent) / 0.15)',
                padding: '6px 12px',
                borderRadius: 16,
                backdropFilter: 'blur(10px)',
              }}>
                <span style={{ 
                  color: 'hsl(var(--accent))', 
                  fontSize: 12, 
                  fontWeight: 500 
                }}>
                  🔊
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  onChange={handleVolumeChange}
                  onClick={(e) => e.stopPropagation()}
                  style={{ 
                    accentColor: 'hsl(var(--primary))', 
                    width: 60,
                    height: 3,
                    borderRadius: 2,
                  }}
                />
                <span style={{ 
                  color: 'hsl(var(--foreground))', 
                  fontSize: 11, 
                  fontWeight: 500,
                  minWidth: 30, 
                  textAlign: 'center'
                }}>
                  {Math.round(volume)}%
                </span>
              </div>
            </div>
          </div>
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
};

export default Video;
