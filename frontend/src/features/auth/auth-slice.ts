import { useAuthStore } from "@/lib/store/auth-store";
import type { User } from "@/lib/store/auth-store";

// Provide a compatible interface for existing Redux code
export interface AuthState {
  user: User | null;
}

// These actions are now just wrappers around our Zustand store
export const setUser = (user: User) => {
  useAuthStore.getState().setUser(user);
};

export const logoutUser = () => {
  useAuthStore.getState().clearUser();
};

// Export a dummy reducer for backward compatibility
const dummyReducer = (state = { user: null }) => state;
export default dummyReducer;

