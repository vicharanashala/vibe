/**
 * Client for the peer-reviewed reflections API.
 *
 * Written by hand rather than through the generated `@/lib/openapi` client
 * because these routes are new and not yet in the committed spec. It follows
 * the same shape as `lib/api/hp-system.ts` so it can be swapped for generated
 * bindings later without touching the hooks that consume it.
 */

const BASE_URL = `${import.meta.env.VITE_BASE_URL}/peer-reviews`;

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

/** Identifies the REFLECTION item a reflection belongs to. */
export interface ReflectionItemRef {
  courseId: string;
  courseVersionId: string;
  itemId: string;
}

export interface ReflectionScores {
  understanding: number;
  depth: number;
  clarity: number;
}

/** A peer's reflection as served to a reviewer — deliberately has no author. */
export interface AnonymousReflection {
  reflectionId: string;
  text: string;
  reviewsCompleted: number;
  reviewsRequired: number;
}

export interface MyReflection {
  reflectionId: string;
  text: string;
  confidence: number;
  reviewsReceived: number;
  reviewsCompleted: number;
  reviewsRequired: number;
  averageScore: number | null;
  helpfulCount: number;
  lockedReason?: 'REVIEWS_PENDING' | 'AWAITING_PEERS';
}

export interface InstructorReflection {
  reflectionId: string;
  userId: string;
  itemId: string;
  text: string;
  confidence: number;
  reviewsReceived: number;
  helpfulCount: number;
  averageScore: number | null;
  status: 'OPEN' | 'CLOSED' | 'WITHDRAWN';
  createdAt: string;
}

export interface ReflectionStats {
  reflectionCount: number;
  reviewCount: number;
  scoredCount: number;
  averageScore: number | null;
  averageConfidence: number | null;
}

const itemPath = (s: ReflectionItemRef) =>
  `${BASE_URL}/courses/${s.courseId}/versions/${s.courseVersionId}` +
  `/items/${s.itemId}`;

export const peerReviewApi = {
  submitReflection(section: ReflectionItemRef, body: {text: string; confidence: number}) {
    return apiFetch<{reflectionId: string}>(`${itemPath(section)}/reflections`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  getMyReflection(section: ReflectionItemRef) {
    return apiFetch<{reflection: MyReflection | null}>(
      `${itemPath(section)}/reflections/me`,
    );
  },

  getNextForReview(section: ReflectionItemRef) {
    return apiFetch<{reflection: AnonymousReflection | null}>(
      `${itemPath(section)}/review-queue/next`,
    );
  },

  submitReview(
    reflectionId: string,
    body: {scores: ReflectionScores; helpful: boolean},
  ) {
    return apiFetch<{reviewsCompleted: number; reviewsRequired: number}>(
      `${BASE_URL}/reflections/${reflectionId}/reviews`,
      {method: 'POST', body: JSON.stringify(body)},
    );
  },

  listForInstructor(courseId: string, courseVersionId: string, itemId?: string) {
    const query = itemId ? `?itemId=${itemId}` : '';
    return apiFetch<{items: InstructorReflection[]}>(
      `${BASE_URL}/courses/${courseId}/versions/${courseVersionId}/reflections${query}`,
    );
  },

  getInstructorStats(
    courseId: string,
    courseVersionId: string,
    itemId?: string,
  ) {
    const query = itemId ? `?itemId=${itemId}` : '';
    return apiFetch<ReflectionStats>(
      `${BASE_URL}/courses/${courseId}/versions/${courseVersionId}/reflections/stats${query}`,
    );
  },
};
