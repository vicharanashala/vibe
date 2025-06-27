import React, { createContext } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { logout, loginWithGoogle, loginWithEmail } from '@/utils/auth';

import type { Role, AuthContextType } from '@/types/auth.types';


// Create a context with default values
export const AuthContext = createContext<AuthContextType>({
  role: null,
  isAuthenticated: false,
  login: () => {},
  loginWithGoogle: async () => {},
  loginWithEmail: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Use the Zustand store
  const { user, isAuthenticated, setUser, clearUser } = useAuthStore();

  // Login function that sets the user in the store
  const login = (selectedRole: Role, uid: string, email: string, name?: string) => {
    if (selectedRole) {
      setUser({
        uid,
        email,
        name,
        role: selectedRole,
      });
    }
  };
  
  // Logout function that clears the user from the store
  const handleLogout = () => {
    logout();
    clearUser();
  };

  return (
    <AuthContext.Provider value={{ 
      role: user?.role || null,
      isAuthenticated,
      login, 
      loginWithGoogle,
      loginWithEmail,
      logout: handleLogout
    }}>
      {children}
    </AuthContext.Provider>
  );
}
