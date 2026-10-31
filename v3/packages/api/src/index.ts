import createClient, { type Middleware } from 'openapi-fetch';

import type { components, paths } from './schema.js';

export type { components, paths } from './schema.js';

/** Shorthand for a backend schema: `Schema<'EnrollmentDataResponse'>`. */
export type Schema<Name extends keyof components['schemas']> =
  components['schemas'][Name];

export interface ApiClientOptions {
  /** Backend origin, e.g. `http://localhost:4001` — paths already carry `/api`. */
  baseUrl: string;
  /** Returns the current Firebase ID token, or null when signed out. */
  getToken: (options?: { forceRefresh?: boolean }) => Promise<string | null>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Typed client for the ViBe backend, generated from its OpenAPI spec.
 *
 * - Attaches `Authorization: Bearer <firebase id token>`.
 * - Retries once with a force-refreshed token on 401.
 * - Several write endpoints answer 200 with an empty body (`@OnUndefined(200)`);
 *   openapi-fetch would try to JSON-parse that, so it is turned into `{}`.
 */
export function createApiClient({ baseUrl, getToken }: ApiClientOptions) {
  const auth: Middleware = {
    async onRequest({ request }) {
      const token = await getToken();
      if (token) request.headers.set('Authorization', `Bearer ${token}`);
      return request;
    },
    async onResponse({ request, response }) {
      if (response.status === 401) {
        const fresh = await getToken({ forceRefresh: true });
        if (fresh) {
          const retry = request.clone();
          retry.headers.set('Authorization', `Bearer ${fresh}`);
          response = await fetch(retry);
        }
      }
      if (response.ok && response.status !== 204 && request.method !== 'GET') {
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
  };

  const client = createClient<paths>({ baseUrl });
  client.use(auth);
  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** Unwraps an openapi-fetch result, throwing ApiError with the backend's message. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || !result.response.ok) {
    const body = result.error as { message?: string } | undefined;
    throw new ApiError(
      result.response.status,
      body?.message ?? `Request failed (${result.response.status})`,
      result.error,
    );
  }
  return result.data as T;
}
