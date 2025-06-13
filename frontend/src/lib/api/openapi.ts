import createFetchClient from 'openapi-fetch';
import createClient from 'openapi-react-query';
import type { paths } from './schema';

const customFetch: typeof fetch = (input, init = {}) => {
  const headers = new Headers(init.headers || {});
  const token = localStorage.getItem('firebase-auth-token');
  headers.set('Authorization', 'Bearer '+token); // Replace with dynamic token if needed
  // Add more headers as needed
  return fetch(input, { ...init, headers });
};

const fetchClient = createFetchClient<paths>({
  baseUrl: "http://localhost:4001",
  fetch: customFetch,
});
export const api = createClient(fetchClient);
