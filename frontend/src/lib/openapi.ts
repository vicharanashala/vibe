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
  baseUrl: `${import.meta.env.VITE_BASE_URL}`
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
    // Handle 401 errors by attempting token refresh
    if (response.status === 401 && refreshTokenFunction) {
      try {
        // Attempt to refresh the token
        await refreshTokenFunction();
        
        // Get the new token and retry the request
        const newToken = getAuthToken();
        if (newToken) {
          // Clone the original request with new token
          const newRequest = request.clone();
          newRequest.headers.set('Authorization', `Bearer ${newToken}`);
          
          // Return the retried request
          return fetch(newRequest);
        }
      } catch (error) {
        console.error('Token refresh failed during API call:', error);
        // If refresh fails, redirect to login or handle as needed
        // This could trigger a logout in your auth context
      }
    }
    
    return response;
  },
});

export const api = createClient(fetchClient);

