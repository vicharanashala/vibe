import React, { createContext, useEffect, useRef, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth-store';
import { logout, loginWithGoogle, loginWithEmail, refreshFirebaseToken } from '@/utils/auth';
import { setTokenRefreshFunction } from '@/lib/openapi';

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
  const { user, isAuthenticated, setUser, clearUser, setToken } = useAuthStore();
  const tokenRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Logout function that clears the user from the store
  const handleLogout = useCallback(() => {
    if (tokenRefreshIntervalRef.current) {
      clearInterval(tokenRefreshIntervalRef.current);
      tokenRefreshIntervalRef.current = null;
    }
    logout();
    clearUser();
  }, [clearUser]);

  // Firebase auth state listener and token management
  useEffect(() => {
    // Register the token refresh function with the API client
    setTokenRefreshFunction(refreshFirebaseToken);
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in, get token and refresh it
        try {
          const token = await firebaseUser.getIdToken(true);
          setToken(token);
          
          // Set up automatic token refresh every 50 minutes (tokens expire in 1 hour)
          if (tokenRefreshIntervalRef.current) {
            clearInterval(tokenRefreshIntervalRef.current);
          }
          
          tokenRefreshIntervalRef.current = setInterval(async () => {
            try {
              await refreshFirebaseToken();
            } catch (error) {
              console.error('Failed to refresh token:', error);
              // If refresh fails, sign out user
              handleLogout();
            }
          }, 50 * 60 * 1000); // 50 minutes in milliseconds
          
        } catch (error) {
          console.error('Error getting initial token:', error);
        }
      } else {
        // User is signed out, clear everything
        if (tokenRefreshIntervalRef.current) {
          clearInterval(tokenRefreshIntervalRef.current);
          tokenRefreshIntervalRef.current = null;
        }
        clearUser();
      }
    });

    // Cleanup function
    return () => {
      unsubscribe();
      if (tokenRefreshIntervalRef.current) {
        clearInterval(tokenRefreshIntervalRef.current);
      }
    };
  }, [setToken, clearUser, handleLogout]);

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
