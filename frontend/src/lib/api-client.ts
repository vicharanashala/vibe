import { auth } from "./firebase";

import { useAuthStore } from "@/store/auth-store";

type ApiResponse<T = unknown> = {
  data: T;
};

type RequestOptions = {
  headers?: Record<string, string>;
};

const getBaseUrl = () => import.meta.env.VITE_BASE_URL ?? "";

const getAuthToken = async (): Promise<string | null> => {
  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      if (token) {
        localStorage.setItem("firebase-auth-token", token);
        useAuthStore.getState().setToken(token);
        return token;
      }
    } catch (e) {
      console.error("Failed to get Firebase ID token:", e);
    }
  }
  return useAuthStore.getState().token || localStorage.getItem("firebase-auth-token");
};

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResponse<T>> {
  const baseUrl = getBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init.headers as Record<string, string>) || {}),
  };

  let response = await fetch(`${baseUrl}${normalizedPath}`, {
    ...init,
    credentials: "include",
    headers,
  });

  // Handle 401 by attempting token refresh once if firebase auth user exists
  if (response.status === 401) {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const freshToken = await currentUser.getIdToken(true);
        if (freshToken) {
          localStorage.setItem("firebase-auth-token", freshToken);
          useAuthStore.getState().setToken(freshToken);
          headers["Authorization"] = `Bearer ${freshToken}`;
          response = await fetch(`${baseUrl}${normalizedPath}`, {
            ...init,
            credentials: "include",
            headers,
          });
        }
      }
    } catch (refreshErr) {
      console.error("Token refresh retry failed in apiClient:", refreshErr);
    }
  }

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
