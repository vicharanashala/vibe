import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

const MIN_INTERVAL_MS = 2 * 60_000;
const MAX_INTERVAL_MS = 5 * 60_000;
const RESPONSE_WINDOW_MS = 10_000;
const TOAST_ID = 'thumbs-up-challenge';

function randomDelay() {
  return MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
}

/**
 * Every 2–5 minutes, asks the student to show a thumbs-up on camera to
 * confirm a live person is present — a liveness nudge, not a hard gate: a
 * missed check-in just surfaces a toast, it never pauses or blocks the lesson.
 */
export function useThumbsUpChallenge(gesture: string | null, enabled: boolean) {
  const nextCheckAt = useRef(0);
  const challengeUntil = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    nextCheckAt.current = Date.now() + randomDelay();
    const interval = window.setInterval(() => {
      const now = Date.now();
      if (challengeUntil.current && now > challengeUntil.current) {
        challengeUntil.current = 0;
        toast.dismiss(TOAST_ID);
        toast('Missed check-in', { description: 'We didn’t see a thumbs-up in time.' });
        nextCheckAt.current = now + randomDelay();
      } else if (!challengeUntil.current && now >= nextCheckAt.current) {
        challengeUntil.current = now + RESPONSE_WINDOW_MS;
        toast('Show a thumbs-up 👍', {
          id: TOAST_ID,
          description: 'Just checking you’re still there.',
          duration: RESPONSE_WINDOW_MS,
        });
      }
    }, 1000);
    return () => {
      window.clearInterval(interval);
      toast.dismiss(TOAST_ID);
    };
  }, [enabled]);

  useEffect(() => {
    if (!challengeUntil.current || !gesture?.toLowerCase().includes('thumb_up')) return;
    challengeUntil.current = 0;
    toast.dismiss(TOAST_ID);
    toast.success('Thanks!', { description: 'Check-in confirmed.' });
    nextCheckAt.current = Date.now() + randomDelay();
  }, [gesture]);
}
