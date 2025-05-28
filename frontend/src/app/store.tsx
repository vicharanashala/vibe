import { useAuthStore } from "@/lib/store/auth-store";

// This file now serves as a compatibility layer for transitioning from Redux to Zustand
// Provides a way to access the state in a similar format to how Redux did

// Return the entire state shape to match what was expected from Redux
export const store = {
  getState: () => ({
    auth: {
      user: useAuthStore.getState().user,
    },
  }),
};

// Define types that match the previous Redux types for compatibility
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = () => void; // Simplified since we don't need dispatch anymore
