import {create} from 'zustand';
import {apiClient} from '@/lib/api-client';
import type {CompanionAnimal, GrowthStage, CompanionMood} from '@/types/companion';

export interface CompanionState {
  animal: CompanionAnimal;
  realProgress: number;
  quizScore: number;      // latest quiz score (most recent), not average
  idleDays: number;       // days since last completed lesson
  stage: GrowthStage;
  mood: CompanionMood;
  studying: boolean;      // live signal: true when student is in an active lesson
  lastActiveAt: string;
  createdAt: string;
  /** True when a new enrollment dropped the average by ≥20 points */
  newJourney: boolean;
}

interface CompanionStore {
  companion: CompanionState | null;
  hasSelected: boolean;
  isLoading: boolean;
  error: string | null;

  fetchCompanion: () => Promise<void>;
  selectAnimal: (animal: CompanionAnimal) => Promise<void>;
  /** Push studying live signal to backend (true = in lesson, false = left lesson) */
  setStudying: (studying: boolean) => Promise<void>;
  /** Acknowledge the "new journey" one-shot message — clears the flag on the backend */
  clearNewJourney: () => Promise<void>;
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
            {signal: controller.signal},
          );
          // Note: shouldClearNewJourney intentionally checks the *previous*
          // poll's state (stored in component refs), not the store. The store
          // only holds the current API snapshot. The actual "did we just
          // transition true→false" check lives inside CompanionWidget.tsx
          // where the one-shot display logic runs.
          set({
            companion: res.data,
            // Only flip hasSelected to false when the API confirms no record exists
            // (res.data === null). On any other response (including errors), preserve
            // the previous value so a transient backend hiccup never makes the user
            // re-select their animal.
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
          // Don't clear hasSelected/companion — a network blip should not wipe
          // the student's existing animal choice.
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

    setStudying: async (studying: boolean) => {
      // Fire-and-forget: don't block the UI or show errors for this signal.
      // The 5-minute TTL on the backend ensures we auto-expire on crash/network loss.
      try {
        await apiClient.patch('/companion/me/studying', {studying});
      } catch {
        // silent — the TTL is the safety net
      }
    },

    clearNewJourney: async () => {
      try {
        await apiClient.patch('/companion/me/new-journey-seen', {});
      } catch {
        // silent — the flag clears server-side on next /companion/me response
      }
    },
  };
});