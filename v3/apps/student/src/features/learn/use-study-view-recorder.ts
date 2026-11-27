import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import { recordStudyView, studyKeys, toSeconds, type LessonItem, type LessonRef } from './queries';

/** Seconds of actual playback after which a study-mode video counts as studied. */
export const STUDY_WATCH_SECONDS = 10;

/** How long a video must play to count: 10 s, or the whole clip if it's shorter. */
export function studyWatchThreshold(item: Pick<LessonItem, 'details'>): number {
  const start = toSeconds(item.details.startTime);
  const end = toSeconds(item.details.endTime);
  const length = end > start ? end - start : 0;
  return length > 0 ? Math.min(STUDY_WATCH_SECONDS, length) : STUDY_WATCH_SECONDS;
}

/**
 * Records a study view for the lesson open in study mode (spec v3/study-progress):
 * an article as soon as it shows, a video once it has actually played for
 * `studyWatchThreshold` seconds in this visit (paused time and seeks don't
 * count). Once per visit; a failure is ignored so studying is never
 * interrupted, and the next visit tries again. Returns the `onPlayingChange`
 * handler to give the video player.
 */
export function useStudyViewRecorder(ref: LessonRef, item: LessonItem): (playing: boolean) => void {
  const queryClient = useQueryClient();
  const done = useRef(false);
  const playedMs = useRef(0);
  const playingSince = useRef<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const counts = item.type === 'VIDEO' || item.type === 'BLOG';
  const thresholdMs = studyWatchThreshold(item) * 1000;

  // The lesson ref and query client can change identity on every render; read
  // the latest through refs so `record` (and the reset below) stay stable and
  // a re-render never starts a new visit.
  const latest = useRef({ ref, queryClient });
  latest.current = { ref, queryClient };

  const record = useCallback(() => {
    if (done.current) return;
    done.current = true;
    window.clearTimeout(timer.current);
    const { ref: r, queryClient: qc } = latest.current;
    void recordStudyView(r).then(
      () => qc.invalidateQueries({ queryKey: studyKeys.progress(r.courseId, r.versionId) }),
      () => undefined,
    );
  }, []);

  // A new lesson starts a new visit.
  useEffect(() => {
    done.current = false;
    playedMs.current = 0;
    playingSince.current = null;
    if (counts && item.type === 'BLOG') record();
    return () => window.clearTimeout(timer.current);
  }, [ref.itemId, item.type, counts, record]);

  return useCallback(
    (playing: boolean) => {
      if (!counts || item.type !== 'VIDEO' || done.current) return;
      window.clearTimeout(timer.current);
      if (playing) {
        playingSince.current = Date.now();
        timer.current = window.setTimeout(record, Math.max(0, thresholdMs - playedMs.current));
      } else if (playingSince.current !== null) {
        playedMs.current += Date.now() - playingSince.current;
        playingSince.current = null;
        if (playedMs.current >= thresholdMs) record();
      }
    },
    [counts, item.type, thresholdMs, record],
  );
}
