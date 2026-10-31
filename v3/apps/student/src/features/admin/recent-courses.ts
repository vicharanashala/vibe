import { useEffect, useSyncExternalStore } from 'react';

import { useAuth } from '@/features/auth/auth-provider';

/** One course the user opened in the studio. Names come from the course list at render time. */
export interface RecentCourse {
  courseId: string;
  versionId: string;
  /** When it was opened (ms). */
  at: number;
}

/** More than the sidebar shows, so courses the user can no longer see leave room for older ones. */
export const RECENT_COURSES_KEPT = 10;

const keyFor = (uid: string) => `studio:recent-courses:${uid}`;

/** Read a user's history. Blocked storage, bad JSON or malformed entries all read as no history. */
export function readRecentCourses(uid: string): RecentCourse[] {
  if (!uid) return [];
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(keyFor(uid));
  } catch {
    return [];
  }
  return parse(raw);
}

function parse(raw: string | null): RecentCourse[] {
  if (!raw) return [];
  try {
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .filter(
        (e): e is RecentCourse =>
          !!e &&
          typeof e.courseId === 'string' &&
          !!e.courseId &&
          typeof e.versionId === 'string' &&
          !!e.versionId &&
          typeof e.at === 'number',
      )
      .slice(0, RECENT_COURSES_KEPT);
  } catch {
    return [];
  }
}

const listeners = new Set<() => void>();

/** Put a course first in the user's history (once), keeping the newest RECENT_COURSES_KEPT. */
export function recordCourseVisit(uid: string, courseId: string, versionId: string, at = Date.now()) {
  if (!uid || !courseId || !versionId) return;
  const next = [{ courseId, versionId, at }, ...readRecentCourses(uid).filter((e) => e.courseId !== courseId)].slice(
    0,
    RECENT_COURSES_KEPT,
  );
  try {
    localStorage.setItem(keyFor(uid), JSON.stringify(next));
  } catch {
    // Storage blocked or full: the sidebar falls back to newest courses.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Other tabs: the browser fires `storage` there when this tab writes.
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith('studio:recent-courses:')) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

// useSyncExternalStore needs a stable snapshot: reuse the parsed list while the stored text is unchanged.
const snapshots = new Map<string, { raw: string | null; list: RecentCourse[] }>();
const EMPTY: RecentCourse[] = [];

function snapshotFor(uid: string): RecentCourse[] {
  if (!uid) return EMPTY;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(keyFor(uid));
  } catch {
    return EMPTY;
  }
  const cached = snapshots.get(uid);
  if (cached && cached.raw === raw) return cached.list;
  const list = parse(raw);
  snapshots.set(uid, { raw, list: list.length ? list : EMPTY });
  return snapshots.get(uid)!.list;
}

/** The signed-in user's recently opened studio courses, newest first. Updates when any tab records a visit. */
export function useRecentCourses(): RecentCourse[] {
  const uid = useAuth().user?.uid ?? '';
  return useSyncExternalStore(
    subscribe,
    () => snapshotFor(uid),
    () => EMPTY,
  );
}

/**
 * Record that the signed-in user opened this course in the studio. Runs when the
 * course or version changes, so moving between tabs or lessons of one course
 * doesn't re-record it.
 */
export function useRecordCourseVisit(courseId: string, versionId: string) {
  const uid = useAuth().user?.uid ?? '';
  useEffect(() => {
    recordCourseVisit(uid, courseId, versionId);
  }, [uid, courseId, versionId]);
}
