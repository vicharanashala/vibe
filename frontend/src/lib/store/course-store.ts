import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CourseInfo {
  courseId: string;
  versionId: string | null;
}

interface CourseState {
  currentCourse: CourseInfo | null;
  setCurrentCourse: (courseInfo: CourseInfo) => void;
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
      clearCurrentCourse: () => set({ currentCourse: null }),
    }),
    {
      name: 'course-store', // unique name for localStorage
      getStorage: () => localStorage,
    }
  )
);
