import { useEffect } from 'react';
import { useStopItem } from './hooks';

// Module-level singleton: shared across foreground stop sources (Video,
// Quiz, visibility-hide handler) and the background flusher. A per-component
// ref doesn't work — the flusher needs to see whether ANY foreground stop is
// in flight, regardless of which component instance owns it. Without the
// singleton, the flusher and a foreground stop opened concurrent
// transactions on the same Progress doc and lost the backend's 5-attempt
// write-conflict retry budget in lockstep.
export const stopGate = { inFlight: false };

const QUEUE_KEY = 'vibe.failedStopQueue';
const QUEUE_TTL_MS = 5 * 60 * 1000;

// Runs at the course-page level so it keeps flushing while items are loading
// and no Video/Quiz is mounted. The previous version lived in Video.tsx —
// after a stop failed and got queued, the user advanced, GET /item 403'd
// (backend currentItem unchanged), and Video never mounted to fire the
// flusher, leaving the learner stuck on a Loading screen forever.
export function useStopQueueFlusher() {
  const stopItem = useStopItem();

  useEffect(() => {
    let cancelled = false;

    const waitForGate = async () => {
      const POLL_MS = 100;
      const MAX_POLLS = 50;
      for (let i = 0; i < MAX_POLLS; i++) {
        if (cancelled) return false;
        if (!stopGate.inFlight) return true;
        await new Promise(r => setTimeout(r, POLL_MS));
      }
      return false;
    };

    const flush = async () => {
      let queue: any[] = [];
      try {
        const raw = localStorage.getItem(QUEUE_KEY);
        queue = raw ? JSON.parse(raw) : [];
      } catch {
        return;
      }
      if (!Array.isArray(queue) || queue.length === 0) return;

      const now = Date.now();
      queue = queue.filter(e => {
        const age = now - (e?.queuedAt ?? 0);
        if (age > QUEUE_TTL_MS) {
          console.warn('[Stop Queue] Dropping expired entry (>5min old):', e?.body?.itemId);
          return false;
        }
        return true;
      });

      const remaining: any[] = [];
      for (const entry of queue) {
        if (cancelled) {
          remaining.push(entry);
          continue;
        }
        const gateClear = await waitForGate();
        if (!gateClear) {
          remaining.push(entry);
          continue;
        }
        stopGate.inFlight = true;
        try {
          await stopItem.mutateAsync({
            params: entry.params,
            body: entry.body,
          });
          console.log('[Stop Queue] Flushed queued stop for item', entry?.body?.itemId);
        } catch (err: any) {
          // 4xx (other than 408/429) are permanent rejections — backend has
          // told us the request will never succeed (e.g. 'Quiz not
          // submitted', 'attemptId required', 'Invalid watch time'). Keeping
          // them in the queue blocks navigation forever because the 403
          // retry handler in course-page waits on a non-empty queue. Drop
          // them so the user can advance.
          const status = err?.response?.status ?? err?.status;
          const isPermanent4xx =
            typeof status === 'number' &&
            status >= 400 &&
            status < 500 &&
            status !== 408 &&
            status !== 429;
          if (isPermanent4xx) {
            console.warn(
              `[Stop Queue] Dropping entry — server rejected ${status}:`,
              entry?.body?.itemId,
              err?.response?.data?.message || err?.message,
            );
          } else {
            console.warn('[Stop Queue] Retry still failing; keeping in queue:', err);
            remaining.push(entry);
          }
        } finally {
          stopGate.inFlight = false;
        }
      }
      try {
        localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
      } catch {
        // ignore
      }
    };

    flush();
    const onOnline = () => flush();
    window.addEventListener('online', onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
