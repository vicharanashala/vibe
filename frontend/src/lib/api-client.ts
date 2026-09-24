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

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status} ${response.statusText}`;
    let errorsDetail: any = null;
    try {
      const errorData = await response.json();
      errorMessage = errorData?.message || errorMessage;
      errorsDetail = errorData?.errors || null;
      console.error(`[apiClient] HTTP ${response.status} Error on ${path}:`, {
        message: errorMessage,
        errors: errorsDetail,
        fullResponse: errorData,
      });
    } catch {
      console.error(`[apiClient] HTTP ${response.status} Non-JSON Error on ${path}`);
    }
    const err: any = new Error(errorMessage);
    err.status = response.status;
    err.errors = errorsDetail;
    throw err;
  }

  const data = await response.json();

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
