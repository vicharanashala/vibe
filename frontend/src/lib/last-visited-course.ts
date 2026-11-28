/**
 * Tracks which course this browser last opened via the learn page, purely
 * client-side (no backend field for this exists) — read back by the
 * dashboard so it knows which card to preload first.
 */
const STORAGE_KEY = "vibe:last-visited-course";

export type LastVisitedCourse = { courseId: string; versionId: string; cohortId?: string };

export function recordLastVisitedCourse(course: LastVisitedCourse) {
  if (!course.courseId || !course.versionId) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(course));
  } catch {
    // Private browsing / storage full / etc. — losing this preference isn't
    // worth failing the page over.
  }
}

export function getLastVisitedCourse(): LastVisitedCourse | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.courseId && parsed?.versionId ? parsed : null;
  } catch {
    return null;
  }
}
