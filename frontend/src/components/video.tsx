import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Play, Pause, SkipBack, SkipForward, Volume2, Captions, Loader2, XCircle, Maximize, Minimize, FastForward } from 'lucide-react';
import { useSkipOptionalItem, useStartItem, useStopItem, useStoreWatchTimeTrack, } from '../hooks/hooks';


import { useCourseStore } from '../store/course-store';
import { usePlayerStore } from '../store/player-store'; // Import the new store
import type { VideoProps, YTPlayerInstance } from '@/types/video.types';

import { toast } from 'sonner';
import { Badge } from './ui/badge';
import { WatchTimeTrackData } from '@/types/user_activity_event.types';


// Helper to format seconds to HH:MM:SS
function formatSecondsToTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Helper to extract YouTube video ID from URL
function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:v=|youtu.be\/?)([\w-]{11})/);
  return match ? match[1] : null;
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

export default function Video({ URL, startTime, nextItemId, endTime, points, anomalies, readyToDetect, rewindVid, pauseVid, doGesture = false, onNext, isProgressUpdating, onDurationChange, keyboardLockEnabled = true, linearProgressionEnabled, seekForwardEnabled, isCompleted, isAlreadyWatched, completedItemIdsRef }: VideoProps) {
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const iframeRef = useRef<HTMLDivElement>(null);
  const stopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSeekTimeRef = useRef<number>(0);
  const lastSeekErrorToastRef = useRef<number>(0);
  const [playerReady, setPlayerReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // const [volume, setVolume] = useState(100);
  // Use the stored playback rate from the player store
  const { playbackRate, setPlaybackRate, volume, setVolume } = usePlayerStore();
  const [maxTime, setMaxTime] = useState(0);
  const [, setIsHovering] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const videoId = getYouTubeId(URL);
  const { currentCourse, setWatchItemId } = useCourseStore();
  const startItem = useStartItem();
  const stopItem = useStopItem();
  const isStopping = stopItem.isPending;
  const stopError = stopItem.error;
  const { mutateAsync: storeWatchTimeTrack } = useStoreWatchTimeTrack();

  // Parse start and end times
  const startTimeSeconds = parseTimeToSeconds(startTime || '0');
  const endTimeSeconds = parseTimeToSeconds(endTime || '');

  const progressStartedRef = useRef(false);
  const progressStoppedRef = useRef(false);
  const watchItemIdRef = useRef<string | null>(null);
  const stopInFlightRef = useRef(false);

  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [subtitlesAvailable, setSubtitlesAvailable] = useState(false);

  // Track if video was playing before gesture pause
  const wasPlayingBeforeGesture = useRef(false);

  // Track if video was playing before rewind pause
  const wasPlayingBeforeRewind = useRef(false);

  // Track if rewind has been processed to prevent multiple triggers
  const rewindProcessedRef = useRef(false);

  // Track if we've already auto-played the video
  const hasAutoPlayedRef = useRef(false)

  // Track maxTime with a ref for synchronous updates (state updates are async)
  const maxTimeRef = useRef(startTimeSeconds);

  // Track grace period completion
  const [gracePeriodCompleted, setGracePeriodCompleted] = useState(false);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Watch time tracking state
  const [watchTimeTrack, setWatchTimeTrack] = useState<WatchTimeTrackData>({
    rewinds: 0,
    fastForwards: 0,
    videoId: '', // Will be set when currentCourse is available
    userId: '',
    courseId: '',
    versionId: '',
    cohortId: undefined, // Will be set when currentCourse is available
    rewindData: [],
    fastForwardData: []
  });
  const watchTimeTrackRef = useRef<WatchTimeTrackData>(watchTimeTrack);

  const wasPlayingBeforeTabSwitch = useRef(false);


  useEffect(() => {
    watchTimeTrackRef.current = watchTimeTrack;
  }, [watchTimeTrack]);

  const sendWatchTimeTrackData = async (capturedTrackData?: WatchTimeTrackData) => {

    try {

      // Use captured data if provided, otherwise use current state
      const dataToSend = capturedTrackData || watchTimeTrackRef.current;

      // Get user ID from current course or localStorage
      const userId = currentCourse?.userId || localStorage.getItem('userId') || '';

      const trackData: WatchTimeTrackData = {
        ...dataToSend,
        userId: userId,
        courseId: currentCourse?.courseId || '',
        versionId: currentCourse?.versionId || '',
        cohortId: currentCourse?.cohortId || undefined,
        // Don't override videoId - use the tracked one
      };
      await storeWatchTimeTrack({ body: trackData });

      // Reset tracking after successful send
      setWatchTimeTrack({
        rewinds: 0,
        fastForwards: 0,
        videoId: currentCourse?.itemId || '', // Use course itemId instead of YouTube video ID
        userId: '',
        courseId: '',
        versionId: '',
        cohortId: undefined,
        rewindData: [],
        fastForwardData: []
      });

    } catch (error) {
      console.error(' [DEBUG] Failed to send watch time track data:', error);
    }
  };

  // Track previous time for seek detection
  const previousTimeRef = useRef(0);
  const seekDetectionRef = useRef(false);
  const captureInProgressRef = useRef(false);

  // HANDLE STOP FAILED CASE, SHOW SKIP OPTION IF FAILED
  const [isStopFailed, setIsStopFailed] = useState(false);
  const { mutateAsync: skipItemAsync, isPending: isSkipping } = useSkipOptionalItem();


  const handleSkipItem = async () => {
    if (!currentCourse?.itemId) return;
    try {

      await skipItemAsync({ params: { path: { itemId: currentCourse?.itemId } } });
      // toast.success('Item skipped successfully');
      handlePlayPause()
      console.log("Handle skip called stop API....")
      onNext?.();
    } catch (error) {
      console.error('Error skipping item:', error);
      toast.error('Failed to skip item');
    }
  };

  const toggleFullscreen = useCallback(async () => {
    const container = videoContainerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
      toast.error('Failed to toggle fullscreen');
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Pause video when user switches browser tabs
  useEffect(() => {
    const handleVisibilityChange = () => {
      const player = playerRef.current;
      if (!player) return;

      if (document.hidden) {
        if (playing) {
          wasPlayingBeforeTabSwitch.current = true;
          player.pauseVideo();
        } else {
          wasPlayingBeforeTabSwitch.current = false;
        }
      } else {
        if (wasPlayingBeforeTabSwitch.current && playerReady) {
          player.playVideo();
          setTimeout(() => { playerRef.current?.setPlaybackRate?.(playbackRate); }, 50);
          wasPlayingBeforeTabSwitch.current = false;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [playing, playerReady, playbackRate]);

  // Wait 10 seconds after readyToDetect becomes true (to match FloatingVideo's grace period)
  useEffect(() => {
    if (readyToDetect && !gracePeriodCompleted) {
      const timer = setTimeout(() => {
        setGracePeriodCompleted(true);
      }, 10000); // 10 seconds to match FloatingVideo's grace period

      return () => clearTimeout(timer);
    }
  }, [readyToDetect, gracePeriodCompleted]);

  // Reset when video changes
  useEffect(() => {
    setGracePeriodCompleted(false);
    hasAutoPlayedRef.current = false; // Reset autoplay flag for new video
    maxTimeRef.current = startTimeSeconds; // Reset maxTime ref

    // Update watchTimeTrack with course info when video changes
    if (currentCourse?.itemId) {
      setWatchTimeTrack(prev => ({
        ...prev,
        videoId: currentCourse.itemId || '',
        courseId: currentCourse.courseId || '',
        versionId: currentCourse.versionId || '',
        cohortId: currentCourse.cohortId || undefined,
      }));
    }
  }, [videoId, startTimeSeconds, currentCourse?.itemId, currentCourse?.courseId, currentCourse?.versionId, currentCourse?.cohortId]);

  // // Ensure video doesn't autoplay accidentally
  // useEffect(() => {
  //   if (playerReady && playerRef.current) {
  //     // Force pause when player becomes ready
  //     playerRef.current.pauseVideo();
  //     console.log('🔒 Safety: Video forced to paused state');
  //   }
  // }, [playerReady]);

  useEffect(() => {
    playerRef.current?.setPlaybackRate?.(playbackRate);
  }, [playbackRate]);

  // Control handlers
  const handlePlayPause = useCallback(() => {
    const player = playerRef.current;
    if (!player || typeof player.pauseVideo !== 'function' || stopInFlightRef.current) return;
    if (playing || isSkipping || isStopFailed || isStopping) {
      player.pauseVideo();
    } else {
      // Prevent playing if current time is at or beyond endTime
      if (endTimeSeconds > 0 && currentTime >= endTimeSeconds) {
        return;
      }
      player.playVideo();
      setTimeout(() => { playerRef.current?.setPlaybackRate?.(playbackRate); }, 50);
    }
  }, [playing, endTimeSeconds, currentTime, isSkipping, isStopFailed, isStopping, playbackRate]);

  const handleBackward = () => {
    const player = playerRef.current;
    if (!player) {
      return;
    }
    const previousTime = currentTime;
    const newTime = Math.max(startTimeSeconds, currentTime - 10);
    player.seekTo(newTime, true);

    // Track the rewind
    setWatchTimeTrack(prev => {
      const newTrack = {
        ...prev,
        rewinds: prev.rewinds + 1,
        rewindData: [...prev.rewindData, {
          from: formatSecondsToTime(previousTime),
          to: formatSecondsToTime(newTime),
          createdAt: new Date().toISOString()
        }]
      };
      return newTrack;
    });
  };

  const handleForward = () => {
    const player = playerRef.current;
    if (!player) {
      return;
    }
    // Allow forward seek if either the video is completed OR seek forward is enabled in settings
    if (!seekForwardEnabled) {
      return;
    }

    const previousTime = currentTime;
    const maxSeekTime = endTimeSeconds > 0 ? endTimeSeconds : duration;
    const newTime = Math.min(maxSeekTime, currentTime + 10);
    player.seekTo(newTime, true);

    // Track the fast forward
    setWatchTimeTrack(prev => {
      const newTrack = {
        ...prev,
        fastForwards: prev.fastForwards + 1,
        fastForwardData: [...prev.fastForwardData, {
          from: formatSecondsToTime(previousTime),
          to: formatSecondsToTime(newTime),
          createdAt: new Date().toISOString()
        }]
      };
      return newTrack;
    });
  };

  //  function to handle stop with debouncing
  const handleStopItem = useCallback(async (watchItemId: string | null, debounceMs: number = 0): Promise<boolean> => {
    // Clear any pending stop request
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }

    // Prevent duplicate concurrent requests
    if (stopInFlightRef.current) {
      console.log('Stop request already in flight, skipping');
      return false;
    }

    return new Promise((resolve) => {
      const executeStop = async () => {
        stopInFlightRef.current = true;
        try {
          if (watchItemId && !isAlreadyWatched && !(currentCourse!.itemId && completedItemIdsRef.current.has(currentCourse!.itemId)) && !isCompleted) {
            await stopItem.mutateAsync({
              params: {
                path: {
                  courseId: currentCourse!.courseId,
                  courseVersionId: currentCourse!.versionId ?? '',
                },
              },
              body: {
                watchItemId,
                itemId: currentCourse!.itemId ?? '',
                moduleId: currentCourse!.moduleId ?? '',
                sectionId: currentCourse!.sectionId ?? '',
                seekForwardEnabled,
                nextItemId,
                cohortId: currentCourse!.cohortId ?? '',
              },
            });
          }

          if (!currentCourse?.itemId) return;
          completedItemIdsRef.current.add(currentCourse!.itemId);

          progressStoppedRef.current = true;
          resolve(true);

        } catch (err: any) {
          console.error('Stop item failed:', err);
          progressStoppedRef.current = true; // Prevent infinite retries
          toast.warning('Unable to save progress.');
          setIsStopFailed(true);
          resolve(false);

        } finally {
          stopInFlightRef.current = false;
          stopTimeoutRef.current = null;
        }
      };

      if (debounceMs > 0) {
        stopTimeoutRef.current = setTimeout(executeStop, debounceMs);
      } else {
        executeStop();
      }
    });
  }, [currentCourse, stopItem, isAlreadyWatched, completedItemIdsRef]);

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
        setTimeout(() => { playerRef.current?.setPlaybackRate?.(playbackRate); }, 50);
        wasPlayingBeforeGesture.current = false;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doGesture, playing]);

  // Handle rewind functionality
  useEffect(() => {
    if (rewindVid && !rewindProcessedRef.current) {
      const player = playerRef.current;
      if (!player) return;

      // Store current playing state before rewind
      wasPlayingBeforeRewind.current = playing;
      const newTime = startTimeSeconds;
      if (!player) return;
      player.seekTo?.(newTime, true);
      rewindProcessedRef.current = true;
    } else if (!rewindVid) {
      // Reset the flag when rewindVid becomes false
      rewindProcessedRef.current = false;
    }
  }, [rewindVid, currentTime, startTimeSeconds, playing]);

  // Handle pause functionality for anomaly detection
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    if (pauseVid) {
      // Pause video due to anomaly detection
      if (playing) {
        player.pauseVideo();
        wasPlayingBeforeRewind.current = true; // Remember it was playing
      }
    } else {
      // Resume video when anomalies are cleared
      // Only resume if it was playing before the rewind/pause
      if (wasPlayingBeforeRewind.current) {
        player.playVideo();
        setTimeout(() => { playerRef.current?.setPlaybackRate?.(playbackRate); }, 50);
        wasPlayingBeforeRewind.current = false; // Reset the flag
      }
    }
  }, [pauseVid, playing]);



  // Autoplay: Wait for grace period completion
  useEffect(() => {
    const player = playerRef.current;

    // Only auto-play if ALL conditions are perfect:
    // 1. Player is ready
    // 2. Camera permissions granted AND grace period completed
    // 3. Video is not already playing
    // 4. Not blocked by any anomalies
    // 5. We haven't auto-played yet
    if (playerReady &&
      readyToDetect &&
      gracePeriodCompleted && // Wait for grace period
      player &&
      !playing &&
      !pauseVid &&
      !rewindVid &&
      !doGesture &&
      !hasAutoPlayedRef.current) {


      const timer = setTimeout(() => {
        if (playerRef.current &&
          !playing &&
          !pauseVid &&
          !rewindVid &&
          !doGesture) {

          playerRef.current.playVideo();
          setTimeout(() => { playerRef.current?.setPlaybackRate?.(playbackRate); }, 50);
          hasAutoPlayedRef.current = true;
        }
      }, 1000); // 1 second final delay

      return () => clearTimeout(timer);
    }
  }, [playerReady, readyToDetect, gracePeriodCompleted, playing, pauseVid, rewindVid, doGesture]);

  // Autoplay: Only trigger once when everything becomes ready
  // useEffect(() => {
  //   const player = playerRef.current;

  //   // Only auto-play if ALL conditions are perfect:
  //   // 1. Player is ready
  //   // 2. Camera permissions granted (readyToDetect = true after grace period)
  //   // 3. Video is not already playing
  //   // 4. Not blocked by any anomalies (pauseVid, rewindVid, doGesture)
  //   // 5. We haven't auto-played yet
  //   if (playerReady && 
  //       readyToDetect && 
  //       player && 
  //       !playing && 
  //       !pauseVid && 
  //       !rewindVid && 
  //       !doGesture &&
  //       !hasAutoPlayedRef.current) {

  //     console.log('🎬 Auto-playing video: All conditions met');

  //     // Small delay to ensure everything is settled
  //     const timer = setTimeout(() => {
  //       if (playerRef.current && 
  //           !playing && 
  //           !pauseVid && 
  //           !rewindVid && 
  //           !doGesture) {

  //         playerRef.current.playVideo();
  //         setTimeout(() => { playerRef.current?.setPlaybackRate?.(playbackRate); }, 50);
  //         hasAutoPlayedRef.current = true;
  //         console.log('✅ Video auto-played successfully');
  //       }
  //     }, 1000); // 1 second delay

  //     return () => clearTimeout(timer);
  //   }
  // }, [playerReady, readyToDetect, playing, pauseVid, rewindVid, doGesture]);

  // // Reset auto-play flag when video changes
  // useEffect(() => {
  //   hasAutoPlayedRef.current = false;
  // }, [videoId]);

  // Debug anomalies
  // useEffect(() => {
  //   if (anomalies && anomalies.length > 0) {
  //     console.log('🔍 [Video] Current anomalies:', anomalies);
  //   }
  // }, [anomalies]);
  // Handle keyboard events including space for play/pause



  function handleSendStartItem() {

    if (!currentCourse?.itemId) return;
    if (!isAlreadyWatched && !completedItemIdsRef.current.has(currentCourse!.itemId) && !isCompleted) {
      startItem.mutate({
        params: {
          path: {
            courseId: currentCourse.courseId,
            courseVersionId: currentCourse.versionId ?? '',
          },
        },
        body: {
          itemId: currentCourse.itemId,
          moduleId: currentCourse.moduleId ?? '',
          sectionId: currentCourse.sectionId ?? '',
          cohortId: currentCourse.cohortId ?? '',
        }
      });
    }
  }

  // Update watchItemId when startItem succeeds
  useEffect(() => {
    if (startItem.data?.watchItemId) {
      watchItemIdRef.current = startItem.data.watchItemId;
      setWatchItemId(startItem.data.watchItemId);
    }
  }, [startItem.data?.watchItemId, setWatchItemId]);


  const forceHighestQuality = (player: YTPlayerInstance) => {
    const qualities = player.getAvailableQualityLevels();
    // console.log("Qualities: ", qualities)

    if (!qualities || qualities.length === 0) return;

    if (qualities.includes('highres')) player.setPlaybackQuality('highres');
    else if (qualities.includes('hd1080')) player.setPlaybackQuality('hd1080');
    else if (qualities.includes('hd720')) player.setPlaybackQuality('hd720');
    else if (qualities.includes('large')) player.setPlaybackQuality('large');
  };

  // Load YouTube IFrame API
  useEffect(() => {
    if (!readyToDetect) return;

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
          // cc_load_policy: 1,
          autohide: 1,
          showinfo: 0,
          playsinline: 1,
          cc_load_policy: subtitlesEnabled ? 1 : 0,
          cc_lang_pref: 'en',
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
            const dur = event.target.getDuration();
            setPlayerReady(true);
            setDuration(dur);
            // setVolume(event.target.getVolume());
            event.target.setVolume(volume);
            setMaxTime(startTimeSeconds);
            event.target.seekTo(startTimeSeconds, true);
            onDurationChange?.(dur);
            event.target.pauseVideo();
            // setPlaying(false);
            // console.log('YouTube player ready - video paused by default');

            // Don't auto-pause here - let the autoplay logic handle it
            console.log('✅ YouTube player ready - waiting for camera to be ready');

          },
          onStateChange: async (event: { data: number; target: YTPlayerInstance }) => {
            if (window.YT && event.data === window.YT.PlayerState.PLAYING) {
              setPlaying(true);
              if (!progressStartedRef.current) {
                handleSendStartItem();
                setVideoEnded(false);
                progressStartedRef.current = true;
              }
              setTimeout(() => {
                forceHighestQuality(event.target);
              }, 500);
            } else if (window.YT && event.data === window.YT.PlayerState.ENDED) {
              setPlaying(false);
              if (!progressStoppedRef.current && currentCourse) {
                const watchItemId = watchItemIdRef.current || currentCourse.watchItemId;
                if (!watchItemId && isAlreadyWatched) {
                  if (currentCourse.courseId === "6981df886e100cfe04f9c4ad") {
                    console.log("Stop API failed for this course")
                  } else {
                    console.log("Fahhhhaaaaa.....")
                    onNext?.();
                  }
                }
                else if (watchItemId) {
                  const success = await handleStopItem(watchItemId, 0); // No debounce on natural end
                  if (success) {
                    console.log("Damnnnn.......")
                    onNext?.();
                  }
                }
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
      // Clear any pending stop timeout
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
        stopTimeoutRef.current = null;
      }
      // Stop if started but not yet stopped (immediate on unmount, no debounce)
      // if (!progressStoppedRef.current && !stopInFlightRef.current && watchItemIdRef.current && currentCourse) {
      //   stopInFlightRef.current = true;
      //   stopItem.mutate({
      //     params: {
      //       path: {
      //         courseId: currentCourse.courseId,
      //         courseVersionId: currentCourse.versionId ?? '',
      //       },
      //     },
      //     body: {
      //       watchItemId: watchItemIdRef.current,
      //       itemId: currentCourse.itemId ?? '',
      //       moduleId: currentCourse.moduleId ?? '',
      //       sectionId: currentCourse.sectionId ?? '',
      //       seekForwardEnabled,
      //       nextItemId,
      //       cohortId: currentCourse.cohortId ?? '',
      //     },
      //   });
      // }
      // Reset references
      progressStartedRef.current = false;
      progressStoppedRef.current = false;
      stopInFlightRef.current = false;
      watchItemIdRef.current = null;

      // Reset player ready state when video changes
      setPlayerReady(false);

      // Destroy player
      if (playerRef.current) {
        playerRef.current.destroy?.();
        playerRef.current = null;
      }
    };
  }, [videoId, startTimeSeconds, readyToDetect]);


  // // Handle keyboard events including space for play/pause
  // useEffect(() => {

  //   if(!keyboardLockEnabled) return;
  //   const handleKeyDown = (e: KeyboardEvent) => {
  //     // Handle space key for play/pause
  //     if (e.code === 'Space') {
  //       e.preventDefault();
  //       e.stopPropagation();
  //       handlePlayPause();
  //       return;
  //     }

  //     const blockedKeys = [
  //       'KeyK', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  //       'KeyM', 'KeyF', 'KeyT', 'KeyC', 'Digit0', 'Digit1', 'Digit2', 'Digit3',
  //       'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9',
  //       'Period', 'Comma', 'KeyI', 'KeyO',
  //     ];

  //     if (blockedKeys.includes(e.code) ||
  //       (e.shiftKey && e.code === 'Period') ||
  //       (e.shiftKey && e.code === 'Comma')) {
  //       e.preventDefault();
  //       e.stopPropagation();
  //     }
  //   };

  //   document.addEventListener('keydown', handleKeyDown, true);
  //   return () => document.removeEventListener('keydown', handleKeyDown, true);
  // }, [handlePlayPause]);

  // Poll current time and enforce time constraints
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (playerReady) {
      interval = setInterval(async () => {

        if (progressStoppedRef.current || stopInFlightRef.current) {
          return;
        }

        const player = playerRef.current;
        if (player && player.getCurrentTime) {
          const time = player.getCurrentTime();
          setCurrentTime(time);
          setDuration(player.getDuration());
          // setVolume(player.getVolume());

          // Enforce startTime constraint
          if (time < startTimeSeconds) {
            if (!player) return;
            player.seekTo(startTimeSeconds, true);
            return;
          }

          // Enforce endTime constraint
          if (endTimeSeconds > 0 && !progressStoppedRef.current && !stopInFlightRef.current && time >= endTimeSeconds && currentCourse) {
            console.log("This if condition is triggred now -> ", "Fahhhhaaaa")
            const watchItemId = watchItemIdRef.current || currentCourse.watchItemId;

            // if (watchItemId) {
            player?.pauseVideo();

            // Check if user recently seeked (within last 3 seconds)
            const timeSinceLastSeek = Date.now() - lastSeekTimeRef.current;
            const debounceTime = timeSinceLastSeek < 3000 ? 2000 : 0;

            // CAPTURE tracking data BEFORE calling handleStopItem
            captureInProgressRef.current = true;
            const capturedTrackData = { ...watchTimeTrackRef.current };

            const success = await handleStopItem(watchItemId, debounceTime);
            if (success) {
              await sendWatchTimeTrackData(capturedTrackData);
              onNext?.();
            }
            // }
          }

          // Handle videos without endTime constraint that reach near completion
          if (endTimeSeconds === 0 && duration > 0 && !progressStoppedRef.current && !stopInFlightRef.current && time >= duration - 2 && currentCourse) {
            console.log("Fahhhhaaaaaaa")
            const watchItemId = watchItemIdRef.current || currentCourse.watchItemId;
            if (watchItemId) {
              player?.pauseVideo();

              // Check if user recently seeked
              const timeSinceLastSeek = Date.now() - lastSeekTimeRef.current;
              const debounceTime = timeSinceLastSeek < 3000 ? 2000 : 0;

              // CAPTURE tracking data BEFORE calling handleStopItem
              const capturedTrackData = { ...watchTimeTrackRef.current };

              const success = await handleStopItem(watchItemId, debounceTime);
              if (success) {
                await sendWatchTimeTrackData(capturedTrackData);
                onNext?.();
              }
            }
          }
          if (endTimeSeconds > 0 && time >= endTimeSeconds) {
            player.pauseVideo();
            if (!player) return;
            player.seekTo(endTimeSeconds, true);
            if (!videoEnded) {
              setVideoEnded(true);
            }
            return;
          }

          // Prevent forward seeking beyond what they've already watched
          // BUT allow forward seeking if either the video is completed OR seek forward is enabled in settings
          const speedTolerance = playbackRate * 1.0;
          const currentMaxTime = maxTimeRef.current; // Use ref for synchronous value
          const timeDifference = time - currentMaxTime;

          // Determine the effective end time (use duration if no end time is set)
          const effectiveEndTime = endTimeSeconds > 0 ? endTimeSeconds : duration;

          if (timeDifference > speedTolerance + 1.0 && time <= effectiveEndTime && !seekForwardEnabled) {
            if (!player) return;
            player.seekTo(currentMaxTime, true);
          } else if (time >= startTimeSeconds && (endTimeSeconds === 0 || time <= endTimeSeconds)) {
            const newMaxTime = Math.max(currentMaxTime, time);
            maxTimeRef.current = newMaxTime; // Update ref immediately
            setMaxTime(newMaxTime); // Update state for UI
          }
        }
      }, Math.max(200, 500 / playbackRate));
    }
    return () => clearInterval(interval);
  }, [playerReady, playbackRate, startTimeSeconds, endTimeSeconds, videoEnded]);

  useEffect(() => {
    if (!keyboardLockEnabled) return;

    const blockedKeys = new Set([
      't', 'i', 'o', 'k', 'f', 'c', 'm', ',', '.',
      'T', 'I', 'O', 'K', 'F', 'C', 'M', '<', '>'
    ]);

    const handler = (rawEvent: KeyboardEvent) => {
      try {
        const tgt = rawEvent.target as HTMLElement | null;

        // Allow typing inside input/textarea/contentEditable
        if (tgt) {
          const tag = tgt.tagName;
          if (tag === 'INPUT' || tag === 'TEXTAREA' || (tgt as HTMLElement).isContentEditable) {
            return;
          }
        }

        // Space: only toggle play/pause, do NOT re-dispatch
        if (rawEvent.code === 'Space') {
          rawEvent.preventDefault();
          rawEvent.stopImmediatePropagation();
          handlePlayPause();
          return;
        }

        // Only handle keys in our blocked set
        if (!blockedKeys.has(rawEvent.key)) return;

        // For these keys, block default and re-dispatch a clean event
        rawEvent.preventDefault();
        rawEvent.stopImmediatePropagation();

        const synthetic = new KeyboardEvent('keydown', {
          key: rawEvent.key,
          code: rawEvent.code,
          bubbles: true,
          cancelable: true,
          shiftKey: rawEvent.shiftKey,
          ctrlKey: rawEvent.ctrlKey,
          altKey: rawEvent.altKey,
          metaKey: rawEvent.metaKey,
        });

        setTimeout(() => document.dispatchEvent(synthetic), 0);
      } catch (err) {
        console.error('Keyboard capture error', err);
      }
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [handlePlayPause, keyboardLockEnabled]);





  const handleToggleSubtitles = () => {
    setSubtitlesEnabled((prev) => {
      const newState = !prev;

      if (playerRef.current) {
        if (newState) {
          playerRef.current.loadModule('captions');
          playerRef.current.setOption('captions', 'track', { languageCode: 'en' });
        } else {
          playerRef.current.setOption('captions', 'track', {});
        }
      }

      return newState;
    });
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

      <ConfirmOverlay
        visible={isStopFailed}
        title="Failed to stop video"
        message={stopError}
        position="bottom-right"
        onCancel={() => setIsStopFailed(false)}
        onConfirm={() => {
          handleSkipItem();
          setIsStopFailed(false);
        }}
      />

      <NavigatingOverlay visible={isStopping || isSkipping} />

      <div
        ref={videoContainerRef}
        style={{
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

          {!readyToDetect ? (  // Show preparing message before player is ready 
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'hsl(var(--muted))',
                borderRadius: '12px 12px 0 0',
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: 'hsl(var(--foreground))',
                  marginBottom: 8,
                }}
              >
                Preparing environment...
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 400,
                  opacity: 0.7,
                }}
              >
                Please wait while we get things ready.
              </div>
            </div>
          ) : (
            // YouTube iframe container
            <>
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

              {/* <div

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

            // onKeyDown={(e) => {

            //   e.preventDefault();

            //   e.stopPropagation();

            // }}


            tabIndex={-1}

          /> */}
              {/* /* add data-video-overlay so the focus-burring effect can detect it */}
              <div data-video-overlay="true"
                style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  background: 'transparent',
                  pointerEvents: 'auto',
                  zIndex: 10,
                  userSelect: 'none',
                  cursor: 'pointer',
                }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handlePlayPause(); }}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
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



              {/* Anomaly Overlay */}

              {(rewindVid || doGesture || (pauseVid && !anomalies?.includes("faceCountDetection"))) && (

                // {(rewindVid || doGesture || pauseVid) && ( ----- to be uncommented later

                <div

                  className='shadow-2xl'

                  style={{

                    position: 'absolute',

                    top: 0,

                    left: 0,

                    right: 0,

                    bottom: 0,

                    background: 'rgba(70,50,0,0.85)',

                    zIndex: 20,

                    display: 'flex',

                    flexDirection: 'column',

                    alignItems: 'center',

                    justifyContent: 'center',

                    pointerEvents: 'auto',

                    borderRadius: '12px 12px 0 0',

                    transition: 'background 0.2s',

                  }}

                >

                  <div

                    className='shadow-2xl'

                    style={{

                      background: 'rgba(255, 255, 255, 1)',

                      borderRadius: 16,

                      padding: '32px 32px 24px 32px',

                      boxShadow: '0 4px 32px rgba(30,41,59,0.10)',

                      display: 'flex',

                      flexDirection: 'column',

                      alignItems: 'center',

                      justifyContent: 'center',

                      maxWidth: 400,

                      margin: '0 auto',

                    }}

                  >

                    <div

                      style={{

                        // background: '#fbbf24',

                        borderRadius: '50%',

                        width: 150,

                        height: 150,

                        display: 'flex',

                        alignItems: 'center',

                        justifyContent: 'center',

                        marginBottom: 18,

                        // boxShadow: '0 2px 12px rgba(30,41,59,0.10)',

                      }}

                    >

                      {/* Warning SVG icon */}

                      {(rewindVid || pauseVid) && (<svg

                        width="140"

                        height="140"

                        viewBox="0 0 156.262 144.407"

                        fill="none"

                        xmlns="http://www.w3.org/2000/svg"

                      >

                        <g transform="matrix(0.99073487,0,0,0.99073487,186.61494,2.4370252)">

                          <path

                            d="m -109.16602,7.2265625 c -0.13666,0.0017 -0.27279,0.017412 -0.40625,0.046875 -3.19494,0.029452 -6.17603,1.6944891 -7.78515,4.4824215 l -31.25,54.126953 -31.25,54.126958 h 0.002 c -3.41988,5.92217 1.01692,13.60908 7.85547,13.60937 h 62.5 62.501953 c 6.838552,-3.2e-4 11.277321,-7.68721 7.857422,-13.60937 l -31.25,-54.126958 -31.251955,-54.126953 c -1.46518,-2.5386342 -4.07917,-4.1634136 -6.97851,-4.4492184 -0.14501,-0.042788 -0.2944,-0.068998 -0.44532,-0.078125 h -0.004 c -0.0312,-0.00138 -0.0625,-0.00203 -0.0937,-0.00195 z"

                            style={{ fill: "#000" }}

                          />

                          <path

                            d="m -109.16545,9.2265625 c -2.63992,-0.1247523 -5.13786,1.2403375 -6.45899,3.5292965 l -31.25,54.126953 -31.25,54.126958 c -2.67464,4.63164 0.77657,10.60914 6.125,10.60937 h 62.5 62.50196 c 5.34844,-2.5e-4 8.79965,-5.97774 6.125,-10.60937 l -31.25,-54.126958 -31.25196,-54.126953 c -1.20213,-2.082863 -3.38689,-3.4150037 -5.78906,-3.5292965 h -0.002 z"

                            style={{ fill: "#fff" }}

                          />

                          <path

                            d="m -109.25919,11.224609 c -1.89626,-0.08961 -3.68385,0.887082 -4.63282,2.53125 l -31.25,54.126953 -31.25,54.126958 c -1.95283,3.38168 0.48755,7.6092 4.39258,7.60937 h 62.5 62.50196 c 3.905026,-1.8e-4 6.345394,-4.2277 4.39257,-7.60937 l -31.25,-54.126958 -31.25195,-54.126953 c -0.86311,-1.495461 -2.42763,-2.44919 -4.15234,-2.53125 z"

                            style={{ fill: "#000" }}

                          />

                          <path

                            d="m -46.997381,124.54655 -62.501079,0 -62.50108,0 31.25054,-54.127524 31.25054,-54.127522 31.25054,54.127521 z"

                            style={{ fill: "#df0000" }}

                          />

                          <g transform="translate(-188.06236)">

                            <circle

                              r="8.8173475"

                              cy="111.11701"

                              cx="78.564362"

                              style={{ fill: "#000" }}

                            />

                            <path

                              d="m 78.564453,42.955078 c -4.869714,-5.59e-4 -8.817839,3.946692 -8.818359,8.816406 3.15625,37.460938 0,0 3.15625,37.460938 8.93e-4,3.126411 2.535698,5.660342 5.662109,5.660156 3.126411,1.86e-4 5.661216,-2.533745 5.662109,-5.660156 3.154297,-37.460938 0,0 3.154297,-37.460938 -5.2e-4,-4.868951 -3.947455,-8.815886 -8.816406,-8.816406 z"

                              style={{ fill: "#000" }}

                            />

                          </g>

                        </g>

                      </svg>)}

                      {doGesture && !rewindVid && !pauseVid && (<img src="https://em-content.zobj.net/source/microsoft/309/thumbs-up_1f44d.png" className="w-auto h-full" />)}

                    </div>

                    <div

                      style={{

                        color: '#1e293b',

                        background: '#fbbf24',

                        padding: '14px 28px',

                        borderRadius: 10,

                        fontWeight: 1000,

                        fontSize: 21,

                        boxShadow: '0 30px 16px rgba(30,41,59,0.13)',

                        textAlign: 'center',

                        letterSpacing: 0.1,

                        maxWidth: 340,

                        lineHeight: 1.2,

                        border: '1px solid #f59e42',



                      }}

                    >

                      {rewindVid || pauseVid

                        ? (

                          <span style={{ fontWeight: 500, fontSize: 15 }}>

                            {anomalies?.includes("voiceDetection") ? (

                              <div style={{ marginBottom: 6 }}>

                                <strong>Don't speak!</strong>

                              </div>

                            ) : <></>}

                            {anomalies?.includes("faceCountDetection") ? (

                              <div style={{ marginBottom: 6 }}>

                                <strong>Only one face!</strong>

                              </div>

                            ) : <></>}

                            {anomalies?.includes("blurDetection") ? (

                              <div style={{ marginBottom: 6 }}>

                                <strong>Keep your camera clear!</strong>

                              </div>

                            ) : <></>}

                            {anomalies?.includes("focus") ? (

                              <div style={{ marginBottom: 6 }}>

                                <strong>Stay focused!</strong>

                              </div>

                            ) : <></>}

                          </span>

                        )

                        : (

                          <span style={{ fontWeight: 500, fontSize: 15 }}>

                            `Gesture Needed!`

                            <br />

                            <>

                              <span>

                                To continue watching your lesson, please show a <strong>thumbs up gesture</strong> in front of your camera.

                              </span>

                              <br />

                              <span style={{ fontWeight: 200, fontSize: 14 }}>

                                This helps us know you’re present and engaged. Once we detect your gesture, the video will resume automatically.

                              </span>

                            </></span>

                        )

                      }

                    </div>

                  </div>

                </div>

              )

              }


            </>
          )}
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
          {/* Progress Bar - Seeking controlled by seekForwardEnabled */}
          <div style={{ marginBottom: 8 }}>
            <Slider
              value={[currentTime]}
              min={startTimeSeconds}
              max={endTimeSeconds > 0 ? endTimeSeconds : duration}
              step={0.1}
              onValueChange={(value) => {
                const newTime = value[0];
                const currentTimeStr = formatSecondsToTime(currentTime);
                const newTimeStr = formatSecondsToTime(newTime);

                // Record seek time 
                lastSeekTimeRef.current = Date.now();

                // Track seek as rewind or fast forward
                if (newTime < currentTime) {
                  setWatchTimeTrack(prev => ({
                    ...prev,
                    rewinds: prev.rewinds + 1,
                    rewindData: [...prev.rewindData, {
                      from: currentTimeStr,
                      to: newTimeStr,
                      createdAt: new Date().toISOString()
                    }]
                  }));
                } else if (newTime > currentTime) {
                  // Fast forward
                  setWatchTimeTrack(prev => ({
                    ...prev,
                    fastForwards: prev.fastForwards + 1,
                    fastForwardData: [...prev.fastForwardData, {
                      from: currentTimeStr,
                      to: newTimeStr,
                      createdAt: new Date().toISOString()
                    }]
                  }));
                }

                // If seekForward is disabled and user tries to seek forward
                if (!seekForwardEnabled && newTime > currentTime) {
                  // Throttle toast to prevent spam (max once every 2 seconds)
                  const now = Date.now();
                  if (now - lastSeekErrorToastRef.current > 2000) {
                    toast.error('You are not allowed to seek forward');
                    lastSeekErrorToastRef.current = now;
                  }
                  return;
                }

                // Allow seeking (backward always, forward only if enabled)
                if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
                  playerRef.current.seekTo(newTime, true);
                } else {
                  console.log('⚠️ [DEBUG] Player not ready or seekTo not available');
                }

                // Cancel any pending stop request when user is actively seeking
                if (stopTimeoutRef.current) {
                  clearTimeout(stopTimeoutRef.current);
                  stopTimeoutRef.current = null;
                }
              }}
              className="w-full"
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
                className="rounded-full w-11 h-11 flex-shrink-0"
                aria-label={playing ? 'Pause' : 'Play'}
              >
                {playing ? <Pause className="h-7 w-7 scale-130" /> : <Play className="h-7 w-7 scale-130" />}
              </Button>

              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleBackward();
                }}
                size="icon"
                variant="secondary"
                className="rounded-full w-11 h-11 flex-shrink-0"
                aria-label="Back 10 seconds"
              >
                <SkipBack className="h-3 w-3 scale-130" />
              </Button>

              {/* Forward seek button - shown when seekForwardEnabled is true */}
              {seekForwardEnabled && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleForward();
                  }}
                  size="icon"
                  variant="secondary"
                  className="rounded-full w-11 h-11 flex-shrink-0"
                  aria-label="Forward 10 seconds"
                  title="Forward 10 seconds"
                >
                  <SkipForward className="h-3 w-3 scale-130" />
                </Button>
              )}

              <span style={{
                color: 'hsl(var(--foreground))',
                fontFamily: 'var(--font-sans)',
                fontSize: 16,
                fontWeight: 700,
                minWidth: 80,
                textShadow: '0 1px 3px hsl(var(--background) / 0.5)',
                flexShrink: 0
              }}>
                {formatTime(Math.max(startTimeSeconds, currentTime))} / {formatTime(endTimeSeconds > 0 ? endTimeSeconds : duration)}
              </span>
            </div>

            {/* Right Controls */}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>

              <TooltipProvider>
                {/* Subtitles */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleToggleSubtitles}
                      variant="ghost"
                      size="icon"
                      className={`rounded-sm relative group transition-colors duration-200 ${subtitlesEnabled
                        ? "text-black dark:text-white"
                        : "text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white"
                        }`}
                    >
                      <span className="scale-[1.4] flex items-center justify-center">
                        <Captions className="h-6 w-6" strokeWidth={2.5} />
                      </span>

                      {subtitlesEnabled && (
                        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-[2px] bg-red-500 rounded-full"></span>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Toggle Subtitles</p>
                  </TooltipContent>
                </Tooltip>

                {/* Speed Control */}
                <Card className="flex flex-row items-center gap-1.5 px-2 py-1.5 bg-accent/15 flex-shrink-0">
                  <span className="hidden md:block text-md font-bold text-foreground min-w-[24px]">
                    Speed
                  </span>
                  <FastForward className="flex md:hidden h-3 w-3 text-accent flex-shrink-0 scale-160" />
                  <Slider
                    value={[playbackRate]}
                    min={0.25}
                    max={2}
                    step={0.05}
                    onValueChange={(value) => {
                      const rate = value[0];
                      const player = playerRef.current;
                      if (player && typeof player.getAvailablePlaybackRates === 'function') {
                        const availableRates = player.getAvailablePlaybackRates!();
                        let closest = availableRates[0];
                        for (const r of availableRates) {
                          if (Math.abs(r - rate) < Math.abs(closest - rate)) closest = r;
                        }
                        player.setPlaybackRate(closest);
                        // Update both local state and global store
                        setPlaybackRate(closest);
                      } else {
                        playerRef.current?.setPlaybackRate(rate);
                        // Update both local state and global store
                        setPlaybackRate(rate);
                      }
                    }}
                    className="w-[80px]"
                  />
                  <span className="text-md font-semibold text-primary min-w-[24px] text-center">
                    {playbackRate.toFixed(2)}x
                  </span>
                </Card>

                {/* Volume Control */}
                <Card className="flex flex-row items-center gap-1.5 px-2 py-1.5 bg-accent/15 flex-shrink-0">
                  <Volume2 className="h-3 w-3 text-accent flex-shrink-0 scale-160" />
                  <Slider
                    value={[volume]}
                    min={0}
                    max={100}
                    onValueChange={(value) => {
                      const v = value[0];
                      setVolume(v);
                      playerRef.current?.setVolume(v);
                    }}
                    className="w-[80px]"
                  />
                  <span className="text-md font-bold text-foreground min-w-[24px] text-center">
                    {Math.round(volume)}%
                  </span>
                </Card>

                {/* Fullscreen Toggle */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFullscreen();
                      }}
                      variant="ghost"
                      size="icon"
                      className="rounded-sm relative group transition-colors duration-200 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white"
                      aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                    >
                      <span className="scale-[1.4] flex items-center justify-center">
                        {isFullscreen ? (
                          <Minimize className="h-6 w-6" strokeWidth={2.5} />
                        ) : (
                          <Maximize className="h-6 w-6" strokeWidth={2.5} />
                        )}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Next Lesson Button */}
          {/*onNext && (
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
          )*/}
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
    </div >
  );
}



type NavigatingOverlayProps = {
  visible: boolean;
  title?: string;
  message?: string;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  variant?: 'blue' | 'red' | 'green';
};

export function NavigatingOverlay({
  visible,
  title = 'Please wait',
  message = 'Navigating to next item…',
  position = 'top-right',
  variant = 'blue',
}: NavigatingOverlayProps) {
  if (!visible) return null;

  const positionClasses: Record<typeof position, string> = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  const variantClasses: Record<
    typeof variant,
    {
      card: string;
      badge: string;
      icon: string;
    }
  > = {
    blue: {
      card: 'border-blue-400/40 bg-blue-600/95 text-blue-50',
      badge: 'border-blue-50/30 bg-blue-50/10 text-blue-50',
      icon: 'bg-blue-50/10',
    },
    red: {
      card: 'border-red-400/40 bg-red-600/95 text-red-50',
      badge: 'border-red-50/30 bg-red-50/10 text-red-50',
      icon: 'bg-red-50/10',
    },
    green: {
      card: 'border-green-400/40 bg-green-600/95 text-green-50',
      badge: 'border-green-50/30 bg-green-50/10 text-green-50',
      icon: 'bg-green-50/10',
    },
  };

  const styles = variantClasses[variant];

  return (
    <div
      className={`absolute z-50 animate-in slide-in-from-right-3 duration-300 ${positionClasses[position]}`}
    >
      <Card className={`shadow-lg backdrop-blur-md ${styles.card}`}>
        <CardContent className="flex items-center gap-3 px-4 py-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded ${styles.icon}`}
          >
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>

          <div className="flex-1 space-y-1">
            <Badge
              variant="outline"
              className={`font-semibold ${styles.badge}`}
            >
              {title}
            </Badge>

            <p className="text-sm font-medium leading-relaxed">
              {message}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
interface ConfirmOverlayProps {
  visible: boolean;
  title: string;
  message: string;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmOverlay({
  visible,
  title,
  message,
  position = "bottom-right",
  onCancel,
  onConfirm,
}: ConfirmOverlayProps) {
  if (!visible) return null;

  const positionClasses: Record<typeof position, string> = {
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
  };

  return (
    <div
      className={`absolute z-50 animate-in slide-in-from-right-3 duration-300 ${positionClasses[position]}`}
    >
      <Card className={`border-red-400/40 ${message === "Invalid watch time" ? "bg-yellow-600/95" : "bg-red-600/95"} text-red-50 shadow-lg backdrop-blur-md w-80`}>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${message === "Invalid watch time" ? "bg-yellow-50/10" : "bg-red-50/10"}`}>
              <XCircle className="h-6 w-6 text-red-50" />
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-semibold text-red-50">{title}</p>
              <p className="text-sm text-red-50/90">{message === "Invalid watch time" ? "This video cannot be marked as completed because the minimum required watch time was not met. Please rewatch the video." : message}</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              className="border-red-200/30 bg-transparent text-red-50 hover:bg-red-50/10 hover:text-red-50"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-red-50 text-red-600 hover:bg-white hover:text-red-700 font-semibold"
              onClick={onConfirm}
            >
              {message === "Invalid watch time" ? "Rewatch" : "Continue"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}