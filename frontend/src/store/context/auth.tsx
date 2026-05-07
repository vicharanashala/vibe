import React, { createContext, useEffect, useRef, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth-store';
import { logout, loginWithGoogle, loginWithEmail, refreshFirebaseToken } from '@/utils/auth';
import { setTokenRefreshFunction } from '@/lib/openapi';
import { toast } from 'sonner';

import type { Role, AuthContextType } from '@/types/auth.types';

// Auto-logout after this many milliseconds of user inactivity. Activity is
// detected from pointer/keyboard/touch events and from the tab becoming
// visible after being hidden. The threshold is intentionally generous so
// learners watching long videos (where the tab is visible but they aren't
// touching anything) are not booted out unfairly.
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes


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

  // Firebase auth state listener and token management
  useEffect(() => {
    // Register the token refresh function with the API client
    setTokenRefreshFunction(refreshFirebaseToken);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('[Auth] onAuthStateChanged fired, user:', firebaseUser ? 'exists' : 'null');
      if (firebaseUser) {
        try {
          console.log('[Auth] Getting fresh token...');
          const token = await firebaseUser.getIdToken(true);
          console.log('[Auth] Fresh token obtained, setting token and authReady');
          setToken(token);
          setAuthReady(true);

          // Set up automatic token refresh every 50 minutes (tokens expire in 1 hour)
          if (tokenRefreshIntervalRef.current) {
            clearInterval(tokenRefreshIntervalRef.current);
          }

          tokenRefreshIntervalRef.current = setInterval(async () => {
            try {
              await refreshFirebaseToken();
            } catch (error) {
              console.error('Failed to refresh token:', error);
              // First retry: try once more before giving up. A transient
              // network blip or a brief Firebase hiccup should not log
              // the learner out.
              try {
                console.log('Retrying token refresh...');
                const firebaseUser = auth.currentUser;
                if (firebaseUser) {
                  const newToken = await firebaseUser.getIdToken(true);
                  setToken(newToken);
                  return;
                }
              } catch (retryError) {
                console.error('Token refresh retry failed:', retryError);
              }
              // Both attempts failed. The token cannot be renewed, which
              // means subsequent API calls will return 401. Sign the user
              // out cleanly so they re-authenticate, instead of leaving
              // the UI in a "logged in" state that silently 401s on
              // every request and can mask account revocation.
              toast.error('Your session has expired. Please sign in again.');
              handleLogout();
            }
          }, 50 * 60 * 1000); // 50 minutes in milliseconds

        } catch (error) {
          console.error('Error getting initial token:', error);
          // Instead of logging out trying to refresh the token once more
          try {
            const retryToken = await firebaseUser.getIdToken(true);
            setToken(retryToken);
          } catch (retryError) {
            console.error('Token refresh on page load failed:', retryError);
            // The initial token fetch and its retry both failed. Treat
            // this as an unrecoverable auth error and force re-login,
            // rather than leaving the app in an authReady=false limbo.
            toast.error('Unable to verify your session. Please sign in again.');
            handleLogout();
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

  // Idle auto-logout.
  //
  // The Firebase token-refresh loop above keeps the session alive
  // indefinitely as long as the tab is open. Without an idle bound, a
  // learner who walks away from a shared/public machine leaves an
  // authenticated session running, and any cached watch-time / progress
  // session ticks against their account. This effect logs the user out
  // after IDLE_TIMEOUT_MS of no detectable interaction.
  //
  // We deliberately count tab visibility as activity (not just pointer /
  // keyboard input) so a learner who is actively watching a long video
  // with the tab focused is not logged out, while a backgrounded tab
  // counts only its last visibility transition as activity.
  useEffect(() => {
    if (!isAuthenticated) return;

    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const triggerIdleLogout = () => {
      console.warn('[Auth] Idle timeout reached — logging out');
      toast.info('You were signed out after a period of inactivity.');
      handleLogout();
    };

    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(triggerIdleLogout, IDLE_TIMEOUT_MS);
    };

    const onVisibility = () => {
      if (!document.hidden) resetIdleTimer();
    };

    const activityEvents: Array<keyof DocumentEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'wheel',
    ];
    activityEvents.forEach(evt =>
      document.addEventListener(evt, resetIdleTimer, { passive: true }),
    );
    document.addEventListener('visibilitychange', onVisibility);

    resetIdleTimer();

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      activityEvents.forEach(evt =>
        document.removeEventListener(evt, resetIdleTimer),
      );
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isAuthenticated, handleLogout]);

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
