import type { QueryClient } from '@tanstack/react-query';

/**
 * Targeted replacement for useItemById's old "distrust every open" guard.
 * Marks one specific item's cached GET stale and, if a component currently
 * has it mounted via useItemById, triggers a background refetch — called
 * from the one place that can actually make a cached isAlreadyWatched
 * answer wrong: course-page.tsx, the instant a failed quiz is known to
 * require a rewatch of the video before it. Every other path to this item
 * (first watch, normal re-visits, a dashboard prefetch) keeps its cached
 * answer, because nothing invalidated it.
 *
 * A standalone module on purpose: hooks.ts pulls in auth-store and other
 * modules with import-time side effects (reading localStorage), which this
 * pure cache helper has no reason to depend on.
 */
export function invalidateItemCache(queryClient: QueryClient, params: { itemId: string }) {
  queryClient.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] === 'get' &&
      query.queryKey[1] ===
        '/courses/{courseId}/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/item/{itemId}' &&
      (query.queryKey[2] as { params?: { path?: { itemId?: string } } } | undefined)?.params?.path
        ?.itemId === params.itemId,
  });
}
