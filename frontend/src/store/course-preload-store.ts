import { create } from 'zustand';

/**
 * Coordinates the dashboard's "preload the last-visited course first" flow
 * across components: the dashboard sets loadingCourseKey while that one
 * course's full preload is in flight, and every course card reads it to
 * know whether it's the one that should show "Loading" (and to hold off on
 * prefetching itself until a priority course, if any, is done — see the
 * gating in CourseCard/CourseListCard).
 */
interface CoursePreloadState {
  loadingCourseKey: string | null;
  setLoadingCourseKey: (key: string | null) => void;
}

export const useCoursePreloadStore = create<CoursePreloadState>((set) => ({
  loadingCourseKey: null,
  setLoadingCourseKey: (loadingCourseKey) => set({ loadingCourseKey }),
}));

export const coursePreloadKey = (courseId: string, versionId: string) => `${courseId}:${versionId}`;
