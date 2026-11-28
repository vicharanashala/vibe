import { queryClient } from "@/lib/client";
import { api } from "@/lib/openapi";
import { prefetchProctoringSettings } from "@/lib/proctoring-settings-cache";

type PrefetchArgs = { courseId: string; versionId: string; cohortId?: string };

/**
 * Warms the exact same React Query cache entries course-page.tsx's hooks
 * read from (useCourseVersionById, useUserProgress, useModuleProgress,
 * useGetEthicsConsent, useItemsBySectionId, useItemById) plus the one that
 * isn't React Query — useGetProcotoringSettings's getSettings(), covered
 * via lib/proctoring-settings-cache.ts — so a dashboard card mounting ahead
 * of time means clicking its Continue button finds everything already
 * cached instead of waterfalling through loading states after the
 * navigation. Proctoring settings matter here as much as the rest: that
 * fetch is what actually clears the component's loading gate, so leaving
 * it un-warmed meant the skeleton still flashed back in after a fully
 * "preloaded" course's video/quiz had already started rendering.
 *
 * Every init object below is copied verbatim from the corresponding hook in
 * hooks.ts / system-notification-hooks.ts — queryOptions()'s queryKey is
 * [method, path, init], hashed by exact shape (a present-but-empty `query`
 * is a different key than no `query` at all), so any drift from the real
 * hook's shape here is a silent cache miss, not a type error.
 *
 * The returned promise resolves only once every one of these has settled
 * (success or failure) — callers that just want to warm the cache in the
 * background can call this without awaiting it; the dashboard's "fully
 * preload the last-visited course before unlocking its card" flow awaits
 * it specifically because it needs to know when there's truly nothing left
 * to wait on.
 */
export async function prefetchCourseLaunch({ courseId, versionId, cohortId }: PrefetchArgs): Promise<void> {
  if (!courseId || !versionId) return;

  const versionPromise = queryClient.prefetchQuery(
    api.queryOptions("get", "/courses/versions/{id}", {
      params: { path: { id: versionId }, ...(cohortId ? { query: { cohortId } } : {}) },
    } as any),
  );
  const moduleProgressPromise = queryClient.prefetchQuery(
    api.queryOptions("get", `/users/progress/courses/${courseId}/versions/${versionId}/modules` as any, {
      params: { path: { courseId, versionId }, query: { cohortId } },
    } as any),
  );
  const ethicsPromise = queryClient.prefetchQuery(
    api.queryOptions("get", "/users/enrollments/courses/{courseId}/versions/{versionId}/ethics-consent" as any, {
      params: { path: { courseId, versionId } },
    } as any),
  );
  const proctoringPromise = prefetchProctoringSettings(courseId, versionId);
  // Same cache useCheckTimeSlotAccessOnDemand's check() reads via fetchQuery
  // — warming it here means the time-slot gate on the dashboard's own click
  // handler (awaited *before* navigate() even fires) resolves instantly
  // too, instead of making the whole click-to-navigate step wait on it.
  const timeSlotPromise = queryClient.prefetchQuery(
    api.queryOptions("get", "/timeslots/check-access/{courseId}/{courseVersionId}", {
      params: { path: { courseId, courseVersionId: versionId } },
    } as any),
  );

  // The progress call tells us *which* item the student left off on, so its
  // data is read (fetchQuery returns it; prefetchQuery doesn't) before the
  // item-level prefetches it feeds into can be kicked off.
  const progressChain = (async () => {
    try {
      const progress: any = await queryClient.fetchQuery(
        api.queryOptions("get", "/users/progress/courses/{courseId}/versions/{courseVersionId}", {
          params: { path: { courseId, courseVersionId: versionId }, query: { cohortId } },
        } as any),
      );

      const moduleId = progress?.currentModule;
      const sectionId = progress?.currentSection;
      const itemId = progress?.currentItem;
      if (!moduleId || !sectionId) return;

      const itemsPromise = queryClient.prefetchQuery(
        api.queryOptions("get", "/courses/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/items", {
          params: { path: { versionId, moduleId, sectionId }, ...(cohortId ? { query: { cohortId } } : {}) },
        } as any),
      );

      const itemPromise = itemId
        ? queryClient.prefetchQuery(
            api.queryOptions(
              "get",
              "/courses/{courseId}/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/item/{itemId}",
              {
                params: {
                  path: { courseId, versionId, itemId, moduleId, sectionId },
                  ...(cohortId ? { query: { cohortId } } : {}),
                },
              } as any,
            ),
          )
        : Promise.resolve();

      await Promise.allSettled([itemsPromise, itemPromise]);
    } catch {
      // Best-effort warm-up only — course-page's own hooks fetch normally if this failed.
    }
  })();

  await Promise.allSettled([
    versionPromise,
    moduleProgressPromise,
    ethicsPromise,
    proctoringPromise,
    timeSlotPromise,
    progressChain,
  ]);
}
