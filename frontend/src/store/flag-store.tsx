import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { FlagState } from '@/types/flag.types';

// Use persist middleware to keep entity selection between page refreshes
export const useFlagStore = create<FlagState>()(
  persist(
    (set) => ({
      currentCourseFlag: null,
      setCurrentCourseFlag: (courseInfo) => {
        console.log("Setting course in flag store:", courseInfo);
        set({ currentCourseFlag: courseInfo });
      },
      setWatchItemId: (watchItemId) => {
        set((state) => ({
          currentCourseFlag: state.currentCourseFlag
            ? { ...state.currentCourseFlag, watchItemId }
            : null,
        }));
      },
     
      clearCurrentCourseFlag: () => set({ currentCourseFlag: null }),
    }),
    {
      name: 'flag-store', // unique name for localStorage
      getStorage: () => localStorage,
    }
  )
);


