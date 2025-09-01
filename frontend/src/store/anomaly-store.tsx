import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AnomalyStore {
  courseId: string | null;
  versionId: string | null;
  moduleId: string | null;
  sectionId: string | null;
  itemId: string | null;
  watchItemId: string | null;
  setCurrentAnomaly: (params: Partial<Omit<AnomalyStore, 'setCurrentAnomaly'>>) => void;
  clearCurrentAnomaly: () => void;
}

export const useAnomalyStore = create<AnomalyStore>()(
  persist(
    (set) => ({
      courseId: null,
      versionId: null,
      moduleId: null,
      sectionId: null,
      itemId: null,
      watchItemId: null,
      
      setCurrentAnomaly: (params) => {
        console.log("Setting anomaly in store:", params);
        set((state) => ({ ...state, ...params }));
      },
      
      clearCurrentAnomaly: () => set({ 
        courseId: null,
        versionId: null,
        moduleId: null,
        sectionId: null,
        itemId: null,
        watchItemId: null,
      }),
    }),
    {
      name: 'anomaly-store',
      getStorage: () => localStorage,
    }
  )
);