/** Client for the minimal comments API. Mirrors `lib/api/case-studies.ts`'s shape. */

const BASE_URL = `${import.meta.env.VITE_BASE_URL}/comments`;

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('firebase-auth-token');
  return {
    'Content-Type': 'application/json',
    ...(token ? {Authorization: `Bearer ${token}`} : {}),
  };
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {...getAuthHeaders(), ...(options?.headers || {})},
    credentials: 'include',
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Request failed (${res.status})`);
  }
  return res.json();
}

export interface CommentItemRef {
  courseId: string;
  courseVersionId: string;
  itemId: string;
}

export interface CommentView {
  commentId: string;
  authorName: string;
  authorUserId: string;
  text: string;
  parentCommentId: string | null;
  createdAt: string;
}

const itemPath = (r: CommentItemRef) =>
  `${BASE_URL}/courses/${r.courseId}/versions/${r.courseVersionId}/items/${r.itemId}`;

export const commentApi = {
  list(ref: CommentItemRef) {
    return apiFetch<{comments: CommentView[]}>(itemPath(ref));
  },

  post(ref: CommentItemRef, body: {text: string; parentCommentId?: string}) {
    return apiFetch<{commentId: string}>(itemPath(ref), {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};
