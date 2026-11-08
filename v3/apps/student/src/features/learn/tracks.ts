import { useQueries } from '@tanstack/react-query';
import { unwrap } from '@vibe/api';
import { useCallback, useState } from 'react';

import { courseKeys, visibleInOrder, type CourseVersion, type SectionItem } from '@/features/courses/queries';
import { api } from '@/lib/api';

/**
 * Two ways through every course. Students see them as "Study mode" (blue) and
 * "Strict mode" (green); the ids stay blue/green so saved choices and
 * `?track=` links keep working.
 *
 * - **blue**  — study mode. Any device, no proctoring, any order (even in
 *   linear courses), rewatch and seek freely. **No progress is saved** and
 *   quizzes can't be taken. Lessons are read with `?mode=study`, so the
 *   backend skips the linear lock, never touches progress, and refuses items
 *   where the instructor has disabled study mode.
 * - **green** — strict mode. Computer only, lessons in order when the course
 *   is linear, with every proctoring detector the course has. The only mode
 *   that saves progress.
 */
export type Track = 'blue' | 'green';

export const TRACKS: Record<Track, { label: string; short: string; description: string }> = {
  blue: {
    label: 'Study mode',
    short: 'Study',
    description: 'Watch and read freely, on any device. Doesn’t count towards your strict progress, and quizzes are taken in strict mode.',
  },
  green: {
    label: 'Strict mode',
    short: 'Strict',
    description: 'On a computer, with proctoring. The only mode that counts towards your progress and certificate.',
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
