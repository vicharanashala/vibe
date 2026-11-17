import { useQuery } from '@tanstack/react-query';
import { unwrap } from '@vibe/api';

import { api } from '@/lib/api';

import type { CourseInsights, InsightsRange } from './types';

export const OVERVIEW_PATH =
  '/api/analytics/courses/{courseId}/versions/{versionId}/overview';

/**
 * The analytics endpoint isn't in the generated API schema yet (the backend
 * lands in its own PR), so it's called through a narrowly typed view of the
 * client. Swap to `api.GET(OVERVIEW_PATH, …)` once `@vibe/api` is regenerated.
 */
type OverviewGet = (
  path: typeof OVERVIEW_PATH,
  init: {
    params: {
      path: { courseId: string; versionId: string };
      query: { range: InsightsRange };
    };
  },
) => Promise<{ data?: CourseInsights; error?: unknown; response: Response }>;

export const insightsKey = (
  courseId: string,
  versionId: string,
  range: InsightsRange,
) => ['admin', 'insights', courseId, versionId, range] as const;

/** While the first build runs, poll this often: each request also advances the build. */
export const BUILD_POLL_MS = 3000;

/**
 * The course Overview's analytics for the last `range` days. While the first
 * build is running it polls every BUILD_POLL_MS and stops once it's ready.
 */
export function useCourseInsights(
  courseId: string,
  versionId: string,
  range: InsightsRange,
) {
  return useQuery({
    queryKey: insightsKey(courseId, versionId, range),
    queryFn: async () =>
      unwrap(
        await (api.GET as unknown as OverviewGet)(OVERVIEW_PATH, {
          params: { path: { courseId, versionId }, query: { range } },
        }),
      ),
    enabled: !!courseId && !!versionId,
    staleTime: 5 * 60_000,
    refetchInterval: (query) =>
      query.state.data?.status === 'building' ? BUILD_POLL_MS : false,
    placeholderData: (previous) => previous,
  });
}
