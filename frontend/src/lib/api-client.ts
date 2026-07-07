type ApiResponse<T = unknown> = {
  data: T;
};

type RequestOptions = {
  headers?: Record<string, string>;
  /**
   * AbortSignal to cancel the in-flight request. Callers should obtain an
   * AbortController, pass `controller.signal`, and call `controller.abort()`
   * on cleanup (typically in a React useEffect cleanup) to avoid setState
   * after unmount.
   */
  signal?: AbortSignal;
};

const getBaseUrl = () => import.meta.env.VITE_BASE_URL ?? "";

const getAuthHeaders = () => {
  const token = localStorage.getItem("firebase-auth-token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResponse<T>> {
  const baseUrl = getBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${baseUrl}${normalizedPath}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(init.headers || {}),
    },
  });

  // 204 No Content (and any other success with an empty body) — leave `data`
  // as `null` instead of crashing `response.json()` on an empty string. This
  // happens for /api/companion/me when the user hasn't picked an animal yet.
  const raw = await response.text();
  let data: unknown = null;
  if (raw.length > 0) {
    try {
      data = JSON.parse(raw);
    } catch {
      // Non-JSON success bodies are unexpected, but we shouldn't crash the
      // caller. Surface them as a string so the caller can still log.
      data = raw;
    }
  }

  if (!response.ok) {
    const message =
      (data && typeof data === 'object' && 'message' in data
        ? String((data as { message: unknown }).message)
        : null) || response.statusText || 'Request failed';
    throw new Error(message);
  }

  return { data: data as T };
}

export const apiClient = {
  get: <T = unknown>(path: string, options?: RequestOptions) =>
    request<T>(path, {
      method: "GET",
      headers: options?.headers,
      signal: options?.signal,
    }),

  post: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers: options?.headers,
      signal: options?.signal,
    }),
};
