import createFetchClient from 'openapi-fetch';
import createClient from 'openapi-react-query';
import type { paths } from '../types/schema';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

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

export const fetchClient: any = createFetchClient<paths>({
  baseUrl: `${import.meta.env.VITE_BASE_URL}`,
  fetch: ((url: RequestInfo | URL, options?: RequestInit) => {
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
  }) as FetchLike,
});

// Add middleware to automatically include Authorization header
fetchClient.use({
  onRequest({ request }: { request: Request }) {
    const token = getAuthToken();
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`);
    }
    return request;
  },

  async onResponse({ response, request }: { response: Response; request: Request }) {
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

export const api: any = createClient(fetchClient);

