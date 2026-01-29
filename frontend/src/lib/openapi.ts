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

const fetchClient = createFetchClient<paths>({
  baseUrl: `${import.meta.env.VITE_BASE_URL}`,
  fetch: (url, options) => {
    console.log("Fetching: ", url);
    console.log("with options:", options);
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

