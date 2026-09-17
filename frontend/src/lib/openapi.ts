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
  fetch: async (url, options) => {
    // openapi-fetch passes a Request object for some requests (like DELETE without body)
    // If we just pass `url` down, it drops the headers added by middleware.
    // Instead, clone it applying options.
    const response = url instanceof Request
      ? await fetch(new Request(url, { ...options, credentials: "include" }))
      : await fetch(url, { ...options, credentials: "include" });

    /**
     * Several backend endpoints (progress stop/skip/reset, etc.) intentionally
     * send an empty 200 body (`@OnUndefined(200)`). openapi-fetch only skips
     * JSON parsing when Content-Length is exactly "0", but Render's proxy
     * doesn't always forward that header for an empty body -- so it falls
     * through to response.json() on empty content and throws "Unexpected end
     * of JSON input", surfacing as a raw parse error instead of a successful
     * mutation. Scoped to non-GET requests since those are the only ones with
     * intentionally-empty responses in this API; GET bodies are never re-read
     * here, avoiding the double-buffering cost for the large ones.
     */
    const method = (options?.method ?? 'GET').toUpperCase();
    if (response.ok && response.status !== 204 && method !== 'GET') {
      const text = await response.clone().text();
      if (text.length === 0) {
        return new Response('{}', {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      }
    }

    return response;
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
      try {
        if (refreshTokenFunction) {
          await refreshTokenFunction();
        }
        const newToken = getAuthToken();
        if (newToken) {
          const newRequest = request.clone();
          newRequest.headers.set('Authorization', `Bearer ${newToken}`);
          return fetch(newRequest);
        }
      } catch (error) {
        console.error('Token refresh failed during API call:', error);
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

