import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type User = {
  uid: string;
  email: string;
  name?: string;
  role: 'teacher' | 'student' | 'admin' | null;
  avatar?: string;
};

type AuthStore = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  
  // Actions
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  clearUser: () => void;
  hasRole: (role: string | string[]) => boolean;
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: localStorage.getItem('auth-token'),
      isAuthenticated: !!localStorage.getItem('auth-token'),
      
      setUser: (user) => set({ user, isAuthenticated: true }),
      setToken: (token) => {
        localStorage.setItem('auth-token', token);
        set({ token, isAuthenticated: true });
      },
      clearUser: () => {
        localStorage.removeItem('auth-token');
        set({ user: null, token: null, isAuthenticated: false });
      },
      hasRole: (role) => {
        const user = get().user;
        if (!user || !user.role) return false;
        
        if (Array.isArray(role)) {
          return role.includes(user.role);
        }
        return user.role === role;
      }
    }),
    {
      name: 'auth-store',
    }
  )
);

// Subscribe to store changes to update the auth header in API client
useAuthStore.subscribe((state) => {
  if (state.token) {
    // Set token for API client (if needed beyond localStorage)
    console.log('Auth token updated in store');
  }
});
