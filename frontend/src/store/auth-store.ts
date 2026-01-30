import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { User, AuthStore } from '@/types/auth.types';

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: localStorage.getItem('firebase-auth-token'),
      isAuthenticated: !!localStorage.getItem('firebase-auth-token'),
      isAuthReady: false,

      setUser: (user) => {
        set({ user, isAuthenticated: true });
      },
      setToken: (token) => {
        localStorage.setItem('firebase-auth-token', token);
        set({ token, isAuthenticated: true });
      },
      clearUser: () => {
        localStorage.removeItem('firebase-auth-token');
        localStorage.removeItem('user-id');
        localStorage.removeItem('user-email');
        localStorage.removeItem('user-firstName');
        localStorage.removeItem('user-lastName');
        set({ user: null, token: null, isAuthenticated: false });
      },
      hasRole: (role) => {
        const user = get().user;
        if (!user || !user.role) return false;

        if (Array.isArray(role)) {
          return role.includes(user.role);
        }
        return user.role === role;
      },
      setAuthReady: (ready) => {
        set({ isAuthReady: ready });
      }
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Subscribe to store changes to update the auth header in API client
useAuthStore.subscribe((state) => {
  if (state.token) {
    // Set token for API client (if needed beyond localStorage)
  }
});
