import createFetchClient from 'openapi-fetch';
import createClient from 'openapi-react-query';
import type { paths } from './schema';

// Helper function to get auth token from localStorage
const getAuthToken = (): string | null => {
  return localStorage.getItem('firebase-auth-token');
};

const fetchClient = createFetchClient<paths>({
  baseUrl: "http://localhost:4001/api"
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
});

export const api = createClient(fetchClient);

