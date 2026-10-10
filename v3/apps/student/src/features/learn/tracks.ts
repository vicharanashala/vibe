import { useQueries } from '@tanstack/react-query';
import { unwrap } from '@vibe/api';
import { useCallback, useState } from 'react';

import { courseKeys, visibleInOrder, type CourseVersion, type SectionItem } from '@/features/courses/queries';
import { api } from '@/lib/api';

/**
 * Two ways through every course (frontend-only; the backend has no notion of tracks).
 * Students see them as "Study mode" (blue) and "Certified mode" (green); the
 * ids stay blue/green so saved choices and `?track=` links keep working:
 *
 * - **blue**  — study mode. Open any lesson the backend will serve, rewatch and
 *   seek freely, take notes. Camera must be on, but nothing is detected or
 *   reported, and **no progress is saved**.
 * - **green** — certified mode. Lessons in order, one at a time, with every
 *   restriction and proctoring detector the course has. Only green progress counts.
 */
export type Track = 'blue' | 'green';

export const TRACKS: Record<Track, { label: string; short: string; description: string }> = {
  blue: {
    label: 'Study mode',
    short: 'Study',
    description: 'Browse and rewatch freely. Nothing is saved to your progress.',
  },
  green: {
    label: 'Certified mode',
    short: 'Certified',
    description: 'Lessons in order, with proctoring. Counts towards your certificate.',
  },
};

export function parseTrack(value: unknown): Track | undefined {
  return value === 'blue' || value === 'green' ? value : undefined;
}

const storageKey = (versionId: string) => `vibe:track:${versionId}`;

/** The student's last chosen track for a course (per browser); green by default. */
export function readTrack(versionId: string): Track {
  try {
    return parseTrack(localStorage.getItem(storageKey(versionId))) ?? 'green';
  } catch {
    return 'green';
  }
}

export function useCourseTrack(versionId: string): [Track, (t: Track) => void] {
  const [track, setTrackState] = useState<Track>(() => readTrack(versionId));
  const setTrack = useCallback(
    (t: Track) => {
      setTrackState(t);
      try {
        localStorage.setItem(storageKey(versionId), t);
      } catch {
        // storage unavailable — the choice still applies for this visit
      }
    },
    [versionId],
  );
  return [track, setTrack];
}

export interface FlatItem extends SectionItem {
  moduleId: string;
  sectionId: string;
}

/** Every visible item of a course version in syllabus order (one request per section). */
export function useFlatSyllabus(version: CourseVersion | undefined) {
  const sections = visibleInOrder(version?.modules ?? []).flatMap((m) =>
    visibleInOrder(m.sections).map((s) => ({ moduleId: m.moduleId, sectionId: s.sectionId })),
  );
  const results = useQueries({
    queries: sections.map((s) => ({
      queryKey: courseKeys.sectionItems(version?._id ?? '', s.moduleId, s.sectionId),
      queryFn: async () =>
        unwrap(
          await api.GET('/api/courses/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/items', {
            params: { path: { versionId: version?._id ?? '', moduleId: s.moduleId, sectionId: s.sectionId } },
          }),
        ) as unknown as SectionItem[],
      enabled: Boolean(version),
    })),
  });
  const pending = !version || results.some((r) => r.isPending);
  const items: FlatItem[] = pending
    ? []
    : sections.flatMap((s, i) => visibleInOrder(results[i].data ?? []).map((item) => ({ ...item, ...s })));
  return { items, pending };
}
