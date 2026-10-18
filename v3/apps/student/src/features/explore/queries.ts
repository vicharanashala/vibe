import { useInfiniteQuery } from '@tanstack/react-query';
import { unwrap } from '@vibe/api';

import { usePendingRegistrations } from '@/features/registration/queries';
import { api } from '@/lib/api';

/**
 * One entry of the course catalogue (GET /courses/public): a public course
 * version, or a public cohort of one. Courses the student is already enrolled
 * in, and cohorts they're already in, are left out by the backend.
 */
export interface PublicCourse {
  type: 'COURSE' | 'COHORT';
  courseId: string;
  courseName: string;
  courseDescription?: string;
  courseVersionId: string;
  versionName?: string;
  cohortId: string | null;
  cohortName: string | null;
}

export const PUBLIC_PAGE_SIZE = 24;

export const exploreKeys = {
  list: (search: string) => ['explore', search] as const,
};

/**
 * The catalogue, a page at a time. The backend's totalDocuments/totalPages
 * describe only the page it returned, so a full page means "maybe more".
 */
export function usePublicCourses(search: string) {
  return useInfiniteQuery({
    queryKey: exploreKeys.list(search),
    initialPageParam: 1,
    staleTime: 5 * 60 * 1000,
    queryFn: async ({ pageParam }) => {
      const raw = unwrap(
        await api.GET('/api/courses/public', {
          params: { query: { page: pageParam, limit: PUBLIC_PAGE_SIZE, ...(search ? { search } : {}) } as never },
        }),
      ) as unknown as { courses?: PublicCourse[] };
      return raw.courses ?? [];
    },
    getNextPageParam: (last, pages) => (last.length === PUBLIC_PAGE_SIZE ? pages.length + 1 : undefined),
    select: (data) => data.pages.flat(),
  });
}

/**
 * Whether the student already asked to join this entry. The catalogue only
 * leaves out enrolments, so a waiting request would otherwise still say "Register".
 */
export function usePendingLookup() {
  const pending = usePendingRegistrations();
  return (c: PublicCourse) =>
    (pending.data ?? []).some(
      (r) => r.versionId === c.courseVersionId && (r.cohortId ?? null) === (c.cohortId ?? null),
    );
}

/** Stable key for a catalogue entry (a version can appear once per public cohort). */
export const publicKey = (c: PublicCourse) => c.cohortId ?? c.courseVersionId;
