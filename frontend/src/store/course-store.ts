import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { CourseInfo, CourseState } from '@/types/course.types';

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
