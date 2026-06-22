import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PlayerState {
  playbackRate: number;
  volume: number;
  subtitlesEnabled: boolean;
  setPlaybackRate: (rate: number) => void;
  setVolume: (volume: number) => void;
  setSubtitlesEnabled: (enabled: boolean) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      playbackRate: 1.0, // Default playback rate
      volume: 100,
      subtitlesEnabled: false,
      setPlaybackRate: (rate: number) => set({ playbackRate: rate }),
      setVolume: (volume) => set({ volume }),
      setSubtitlesEnabled: (enabled) => set({ subtitlesEnabled: enabled }),
    }),
    {
      name: 'player-storage', // unique name for localStorage
    }
  )
);
