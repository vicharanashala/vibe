import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CourseInfo {
  courseId: string;
  versionId: string | null;
  moduleId: string | null;
  sectionId: string | null;
  itemId: string | null;
  watchItemId: string | null;
}

interface CourseState {
  currentCourse: CourseInfo | null;
  setCurrentCourse: (courseInfo: CourseInfo) => void;
  setWatchItemId: (watchItemId: string) => void;
  clearCurrentCourse: () => void;
}

// Use persist middleware to keep course selection between page refreshes
export const useCourseStore = create<CourseState>()(
  persist(
    (set) => ({
      currentCourse: null,
      setCurrentCourse: (courseInfo) => {
        console.log("Setting course in store:", courseInfo);
        set({ currentCourse: courseInfo });
      },
      setWatchItemId: (watchItemId) => {
        set((state) => ({
          currentCourse: state.currentCourse
            ? { ...state.currentCourse, watchItemId }
            : null,
        }));
      },
      clearCurrentCourse: () => set({ currentCourse: null }),
    }),
    {
      name: 'course-store', // unique name for localStorage
      getStorage: () => localStorage,
    }
  )
);
