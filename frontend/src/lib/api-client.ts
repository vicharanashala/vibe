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

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || "Request failed");
  }

  return { data };
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
