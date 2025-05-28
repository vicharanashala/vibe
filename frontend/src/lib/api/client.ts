import createClient from 'openapi-fetch';
import { QueryClient } from '@tanstack/react-query';

// Create Query Client for React Query
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60, // 1 hour
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Base API URL - this should point to your backend
const BASE_URL = 'https://localhost:4001/api';

// Create API client
export const apiClient = createClient({
  baseUrl: BASE_URL,
});

// Helper to get auth token from storage
export const getAuthToken = (): string | null => {
  const token = localStorage.getItem('auth-token');
  return token;
};

// Helper to set auth token
export const setAuthToken = (token: string | null): void => {
  if (token) {
    localStorage.setItem('auth-token', token);
  } else {
    localStorage.removeItem('auth-token');
  }
};

// Define a type for options that may have headers
type RequestOptions = {
  headers?: Record<string, string>;
  [key: string]: unknown;
};

// Helper to add auth headers to requests
export const withAuth = <T extends RequestOptions>(options: T): T => {
  const token = getAuthToken();
  if (token) {
    return {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    };
  }
  return options;
};

// Add auth token to requests
apiClient.use({
  onRequest(req) {
    const token = getAuthToken();
    if (token && req instanceof Request) {
      req.headers.set('Authorization', `Bearer ${token}`);
      return req; // Return the modified Request object
    }
    return undefined; // Return undefined if we can't modify the request
  },
  onResponse(res) {
    // Handle 401 Unauthorized responses
    if (res.response.status === 401) {
      // Clear auth token and redirect to login
      localStorage.removeItem('auth-token');
      window.location.href = '/auth';
    }
    return res.response;
  }
});