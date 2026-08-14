import createFetchClient from 'openapi-fetch';
import createClient from 'openapi-react-query';
import type { paths } from '../types/schema';

// Helper function to get auth token from localStorage
const getAuthToken = (): string | null => {
  return localStorage.getItem('firebase-auth-token');
};

// Helper function to refresh token (will be imported from auth utils)
let refreshTokenFunction: (() => Promise<void>) | null = null;

// Function to set the refresh token function (called from auth context)
export const setTokenRefreshFunction = (refreshFn: () => Promise<void>) => {
  refreshTokenFunction = refreshFn;
};

export const fetchClient = createFetchClient<paths>({
  baseUrl: `${import.meta.env.VITE_BASE_URL}`,
  fetch: (url, options) => {
    // openapi-fetch passes a Request object for some requests (like DELETE without body)
    // If we just pass `url` down, it drops the headers added by middleware.
    // Instead, clone it applying options.
    if (url instanceof Request) {
      const newReq = new Request(url, { ...options, credentials: "include" });
      return fetch(newReq);
    }
    return fetch(url, {
      ...options,
      credentials: "include",
    });
  },
});

// Add middleware to automatically include Authorization header
fetchClient.use({
  onRequest({ request }) {
    const token = getAuthToken();
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`);
    }
    return request;
  },

  async onResponse({ response, request }) {
    if (response.status === 401) {
      // A 401 means our stored token was rejected. Refresh it (the listener in
      // AuthProvider keeps it fresh, but this is the safety net for the window
      // where auth.currentUser isn't restored yet) and retry the request.
      // Retry a few times so a transient "session not restored yet" race
      // self-heals instead of surfacing as a user-visible 401.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (refreshTokenFunction) {
            await refreshTokenFunction();
          }
        } catch (error) {
          console.warn(`Token refresh attempt ${attempt} failed:`, error);
        }
        const newToken = getAuthToken();
        if (newToken) {
          const newRequest = request.clone();
          newRequest.headers.set('Authorization', `Bearer ${newToken}`);
          return fetch(newRequest);
        }
        // currentUser isn't ready yet - wait briefly and try again.
        await new Promise(resolve => setTimeout(resolve, 400));
      }
      try {
        const { auth: firebaseAuth } = await import('@/lib/firebase');
        const firebaseUser = firebaseAuth.currentUser;
        if (firebaseUser) {
          const freshToken = await firebaseUser.getIdToken(true);
          localStorage.setItem('firebase-auth-token', freshToken);
          const retryRequest = request.clone();
          retryRequest.headers.set('Authorization', `Bearer ${freshToken}`);
          return fetch(retryRequest);
        }
      } catch (retryError) {
        console.error('API interceptor: Final token refresh attempt failed:', retryError);
      }
    }
    return response;
  },
});

export const api = createClient(fetchClient);

