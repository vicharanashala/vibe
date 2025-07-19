import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PlayerState {
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      playbackRate: 1.0, // Default playback rate
      setPlaybackRate: (rate: number) => set({ playbackRate: rate }),
    }),
    {
      name: 'player-storage', // unique name for localStorage
    }
  )
);
