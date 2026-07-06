import {create} from 'zustand';
import {apiClient} from '@/lib/api-client';
import type {CompanionAnimal, GrowthStage, CompanionMood} from '@/types/companion';

export interface CompanionState {
  animal: CompanionAnimal;
  realProgress: number;
  realQuizScore: number;
  idleDays: number;
  stage: GrowthStage;
  mood: CompanionMood;
  lastActiveAt: string;
  createdAt: string;
}

interface CompanionStore {
  companion: CompanionState | null;
  hasSelected: boolean;
  isLoading: boolean;
  error: string | null;

  fetchCompanion: () => Promise<void>;
  selectAnimal: (animal: CompanionAnimal) => Promise<void>;
}

export const useCompanionStore = create<CompanionStore>((set) => ({
  companion: null,
  hasSelected: false,
  isLoading: false,
  error: null,

  fetchCompanion: async () => {
    set({isLoading: true, error: null});
    try {
      const res = await apiClient.get<CompanionState | null>('/companion/me');
      set({
        companion: res.data,
        hasSelected: res.data !== null,
        isLoading: false,
      });
    } catch {
      set({isLoading: false, hasSelected: false});
    }
  },

  selectAnimal: async (animal: CompanionAnimal) => {
    set({isLoading: true, error: null});
    try {
      const res = await apiClient.post<CompanionState>('/companion/me', {animal});
      set({companion: res.data, hasSelected: true, isLoading: false});
    } catch (err: any) {
      set({error: err.message ?? 'Failed to select companion', isLoading: false});
    }
  },
}));