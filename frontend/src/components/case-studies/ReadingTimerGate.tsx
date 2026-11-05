import {useEffect, useRef, useState} from 'react';
import {Clock} from 'lucide-react';
import {reportCaseStudyAnomaly} from '@/lib/api/anomaly-events';

interface ReadingTimerGateProps {
  /** ISO timestamp — the server-anchored timer origin (PLANNING.md §4.6). */
  servedAt: string;
  minimumScreenTimeSeconds: number;
  anomalyContext: {courseId: string; versionId: string; itemId: string};
  /** Fires whenever the locked/unlocked state changes, so the parent can gate its pick buttons. */
  onLockChange: (locked: boolean) => void;
}

/**
 * The countdown/lock overlay. Ticks down from a server-anchored origin, so a
 * page refresh can't shorten the wait — but per PLANNING.md §4.6, switching
 * away and back (`visibilitychange`) restarts the *visible* countdown rather
 * than resuming it, as a deterrent against reading elsewhere mid-timer. This
 * is UX friction, not the real gate: `submitPick` re-validates the true
 * elapsed time server-side regardless of what this component displays
 * (§4.8) — a client bug here can make the button unlock early or late but
 * can never make the server accept a premature pick.
 */
export default function ReadingTimerGate({
  servedAt,
  minimumScreenTimeSeconds,
  anomalyContext,
  onLockChange,
}: ReadingTimerGateProps) {
  const servedAtMs = useRef(new Date(servedAt).getTime());
  const [lockedUntilMs, setLockedUntilMs] = useState(
    () => servedAtMs.current + minimumScreenTimeSeconds * 1000,
  );
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    Math.max(0, Math.ceil((lockedUntilMs - Date.now()) / 1000)),
  );
  const wasHiddenRef = useRef(false);
  const lastReportedLocked = useRef<boolean | null>(null);

  // A new served pair resets both the countdown origin and any prior restart.
  useEffect(() => {
    servedAtMs.current = new Date(servedAt).getTime();
    setLockedUntilMs(servedAtMs.current + minimumScreenTimeSeconds * 1000);
  }, [servedAt, minimumScreenTimeSeconds]);

  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockedUntilMs - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      const locked = remaining > 0;
      if (lastReportedLocked.current !== locked) {
        lastReportedLocked.current = locked;
        onLockChange(locked);
      }
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [lockedUntilMs]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        wasHiddenRef.current = true;
        return;
      }
      if (!wasHiddenRef.current) return;
      wasHiddenRef.current = false;
      // Restart, don't resume — PLANNING.md §4.6's "next time when I come to
      // the screen, the timer will restart" behaviour.
      setLockedUntilMs(Date.now() + minimumScreenTimeSeconds * 1000);
      reportCaseStudyAnomaly({
        type: 'TAB_SWITCH_DURING_REVIEW',
        courseId: anomalyContext.courseId,
        versionId: anomalyContext.versionId,
        itemId: anomalyContext.itemId,
      });
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [minimumScreenTimeSeconds, anomalyContext.courseId, anomalyContext.versionId, anomalyContext.itemId]);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const locked = remainingSeconds > 0;

  return (
    <div
      data-testid="reading-timer-gate"
      data-locked={locked}
      data-remaining-seconds={remainingSeconds}
      className="flex items-center justify-center gap-2 rounded-lg border bg-muted/40 px-4 py-2.5 text-sm"
      role="status"
      aria-live="polite"
    >
      <Clock className={locked ? 'h-4 w-4 text-muted-foreground' : 'h-4 w-4 text-primary'} />
      {locked ? (
        <span className="tabular-nums text-muted-foreground">
          Read both responses fully — picks unlock in {minutes}:{seconds.toString().padStart(2, '0')}
        </span>
      ) : (
        <span className="font-medium text-primary">You can make your pick now</span>
      )}
    </div>
  );
}
