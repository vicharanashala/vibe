/**
 * Warms the exact fetch useGetProcotoringSettings's getSettings() makes, so
 * a dashboard card's preload can cover it too. Not React Query — this hook
 * predates that and calls fetch() directly — so a plain Map keyed by
 * courseId:versionId is the whole cache: one in-flight/settled promise per
 * course, reused by whichever caller (prefetch or the real getSettings())
 * asks for it first.
 */
const cache = new Map<string, Promise<any>>();

const keyOf = (courseId: string, versionId: string) => `${courseId}:${versionId}`;

function fetchProctoringSettings(courseId: string, versionId: string): Promise<any> {
  return fetch(`${import.meta.env.VITE_BASE_URL}/setting/course-setting/${courseId}/${versionId}`, {
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${localStorage.getItem('firebase-auth-token')}`,
    },
  }).then((res) => {
    if (!res.ok) throw new Error(`Failed to fetch settings: ${res.status}`);
    return res.json();
  });
}

export function prefetchProctoringSettings(courseId: string, versionId: string): Promise<any> {
  const key = keyOf(courseId, versionId);
  const existing = cache.get(key);
  if (existing) return existing;

  const promise = fetchProctoringSettings(courseId, versionId);
  cache.set(key, promise);
  // A failed prefetch shouldn't poison the real getSettings() call that
  // happens later — let that one retry with a fresh request instead of
  // replaying the same rejection.
  promise.catch(() => cache.delete(key));
  return promise;
}

export function getCachedProctoringSettings(courseId: string, versionId: string): Promise<any> | undefined {
  return cache.get(keyOf(courseId, versionId));
}
