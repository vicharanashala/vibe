import { RefObject, useEffect, useRef } from 'react';

/**
 * Syncs an HTML5 <video> element with a primary video's React state.
 * Debounces seek corrections and uses requestAnimationFrame for drift correction.
 */
export function useSyncPlayback(
  secondaryRef: RefObject<HTMLVideoElement>,
  playing: boolean,
  currentTime: number,
  playbackRate: number
) {
  const syncLoopRef = useRef<number>();
  const lastUpdateRealTimeRef = useRef<number>(performance.now());
  const lastStateTimeRef = useRef<number>(currentTime);
  const seekTimeoutRef = useRef<NodeJS.Timeout>();

  // Track React state updates to estimate exact primary time between coarse polls
  useEffect(() => {
    const now = performance.now();
    const timeDelta = Math.abs(currentTime - lastStateTimeRef.current);
    
    // Detect large jumps (>1s) as seeks
    if (timeDelta > 1) {
      if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
      // Debounce seek
      seekTimeoutRef.current = setTimeout(() => {
        if (secondaryRef.current && Math.abs(secondaryRef.current.currentTime - currentTime) > 0.3) {
          secondaryRef.current.currentTime = currentTime;
        }
      }, 100);
    }
    
    lastStateTimeRef.current = currentTime;
    lastUpdateRealTimeRef.current = now;
  }, [currentTime, secondaryRef]);

  // Handle Play/Pause
  useEffect(() => {
    const video = secondaryRef.current;
    if (!video) return;

    if (playing) {
      video.play().catch(console.warn);
    } else {
      video.pause();
    }
  }, [playing, secondaryRef]);

  // Handle Playback Rate
  useEffect(() => {
    const video = secondaryRef.current;
    if (video) {
      video.playbackRate = playbackRate;
    }
  }, [playbackRate, secondaryRef]);

  // Continuous Drift Correction
  useEffect(() => {
    if (!playing) return;

    const checkDrift = () => {
      if (secondaryRef.current) {
        const now = performance.now();
        const elapsedSinceUpdate = (now - lastUpdateRealTimeRef.current) / 1000;
        
        // Extrapolate the expected current time of the primary video
        const estimatedPrimaryTime = lastStateTimeRef.current + (elapsedSinceUpdate * playbackRate);
        const drift = Math.abs(secondaryRef.current.currentTime - estimatedPrimaryTime);
        
        // Sync if drift > 0.3s and we received a state update recently (<2s ago)
        if (drift > 0.3 && elapsedSinceUpdate < 2) {
          secondaryRef.current.currentTime = estimatedPrimaryTime;
        }
      }
      syncLoopRef.current = requestAnimationFrame(checkDrift);
    };

    syncLoopRef.current = requestAnimationFrame(checkDrift);

    return () => {
      if (syncLoopRef.current) cancelAnimationFrame(syncLoopRef.current);
    };
  }, [playing, playbackRate, secondaryRef]);
}
