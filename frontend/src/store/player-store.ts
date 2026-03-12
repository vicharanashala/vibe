import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PlayerState {
  playbackRate: number;
  volume: number;
  setPlaybackRate: (rate: number) => void;
  setVolume: (volume: number) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      playbackRate: 1.0, // Default playback rate
      volume: 100,
      setPlaybackRate: (rate: number) => set({ playbackRate: rate }),
      setVolume: (volume) => set({ volume }),
    }),
    {
      name: 'player-storage', // unique name for localStorage
    }
  )
);
