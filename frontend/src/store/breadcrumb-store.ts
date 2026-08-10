import { create } from 'zustand';

interface BreadcrumbState {
  dynamicLabels: Record<string, string>;
  setDynamicLabel: (pathSegment: string, label: string) => void;
}

export const useBreadcrumbStore = create<BreadcrumbState>((set) => ({
  dynamicLabels: {},
  setDynamicLabel: (pathSegment, label) => set((state) => ({ 
    dynamicLabels: { ...state.dynamicLabels, [pathSegment]: label } 
  }))
}));
