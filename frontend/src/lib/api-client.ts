type ApiResponse<T = unknown> = {
  data: T;
};

type RequestOptions = {
  headers?: Record<string, string>;
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
    }),

  post: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers: options?.headers,
    }),
};
