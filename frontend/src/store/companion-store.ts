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

export const useCompanionStore = create<CompanionStore>((set) => {
  // Track an in-flight fetch so concurrent callers (e.g. React Strict Mode
  // double-invocation, or a 30s poll firing while another fetch is still
  // pending) share one network request instead of racing.
  let inFlight: Promise<void> | null = null;
  return {
    companion: null,
    hasSelected: false,
    isLoading: false,
    error: null,

    fetchCompanion: async () => {
      if (inFlight) return inFlight;
      set({isLoading: true, error: null});
      // Per-call AbortController so consumers (or the visibility-aware poller)
      // can cancel an outstanding request instead of receiving its result after
      // a tear-down, which would otherwise call setState on an unmounted store.
      const controller = new AbortController();
      inFlight = (async () => {
        try {
          const res = await apiClient.get<CompanionState | null>(
            '/companion/me',
            { signal: controller.signal },
          );
          set({
            companion: res.data,
            // Only flip hasSelected to false when the API confirms no record exists
            // (res.data === null). On any other response (including errors), preserve
            // the previous value so a transient backend hiccup never makes the user
            // re-select their animal and overwrite the existing DB row.
            hasSelected: res.data !== null,
            isLoading: false,
          });
        } catch (err: unknown) {
          // Aborted requests are part of normal lifecycle; do not surface them
          // as errors and do not clear companion state.
          if (controller.signal.aborted) {
            set({isLoading: false});
            return;
          }
          // Don't clear hasSelected/companion here — a network blip should not wipe
          // the student's existing animal choice. Just record the error and stop
          // the loading spinner so the UI can show an error state if it wants to.
          const message =
            err instanceof Error ? err.message : 'Failed to load companion';
          set({isLoading: false, error: message});
        } finally {
          inFlight = null;
        }
      })();
      return inFlight;
    },

  selectAnimal: async (animal: CompanionAnimal) => {
    set({isLoading: true, error: null});
    try {
      const res = await apiClient.post<CompanionState>('/companion/me', {animal});
      set({companion: res.data, hasSelected: true, isLoading: false});
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to select companion';
      set({error: message, isLoading: false});
    }
  },
  };
});