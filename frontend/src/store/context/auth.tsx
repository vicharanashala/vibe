import React, { createContext, useEffect, useRef, useCallback } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth-store';
import { logout, loginWithGoogle, loginWithEmail, refreshFirebaseToken } from '@/utils/auth';
import { setTokenRefreshFunction } from '@/lib/openapi';

import type { Role, AuthContextType } from '@/types/auth.types';


// Create a context with default values
export const AuthContext = createContext<AuthContextType>({
  role: null,
  isAuthenticated: false,
  login: () => { },
  loginWithGoogle: async () => { },
  loginWithEmail: async () => { },
  logout: () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, setUser, clearUser, setToken, setAuthReady } = useAuthStore();
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

  // Firebase auth state listener and token management.
  // Uses onIdTokenChanged instead of onAuthStateChanged: it fires whenever the
  // auth state changes AND whenever the SDK refreshes the ID token (Firebase
  // auto-refreshes before the 1-hour expiry), so the token we store in
  // localStorage is kept fresh automatically instead of only at login.
  useEffect(() => {
    // Register the token refresh function with the API client
    setTokenRefreshFunction(refreshFirebaseToken);

    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      console.log('[Auth] onIdTokenChanged fired, user:', firebaseUser ? 'exists' : 'null');
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken(true);
          setToken(token);
          setAuthReady(true);

          // Safety net for the emulator (which doesn't proactively rotate
          // tokens before expiry): also refresh on a fixed cadence. ID tokens
          // last 1 hour, so 50 minutes leaves plenty of headroom.
          if (tokenRefreshIntervalRef.current) {
            clearInterval(tokenRefreshIntervalRef.current);
          }
          tokenRefreshIntervalRef.current = setInterval(async () => {
            try {
              await refreshFirebaseToken();
            } catch (error) {
              console.error('Failed to refresh token:', error);
              try {
                const retryUser = auth.currentUser;
                if (retryUser) {
                  const newToken = await retryUser.getIdToken(true);
                  setToken(newToken);
                }
              } catch (retryError) {
                console.error('Token refresh retry failed:', retryError);
              }
            }
          }, 50 * 60 * 1000); // 50 minutes in milliseconds
        } catch (error) {
          console.error('Error getting initial token:', error);
          // Don't bail out of auth on a transient token failure - try once more.
          try {
            const retryToken = await firebaseUser.getIdToken(true);
            setToken(retryToken);
          } catch (retryError) {
            console.error('Token refresh on page load failed:', retryError);
          }
        }
      } else {
        // User is signed out, clear everything
        if (tokenRefreshIntervalRef.current) {
          clearInterval(tokenRefreshIntervalRef.current);
          tokenRefreshIntervalRef.current = null;
        }
        clearUser();
        setAuthReady(true);
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
