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

/** Identifies the section a reflection belongs to. */
export interface SectionRef {
  courseId: string;
  courseVersionId: string;
  moduleId: string;
  sectionId: string;
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
  sectionId: string;
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

const sectionPath = (s: SectionRef) =>
  `${BASE_URL}/courses/${s.courseId}/versions/${s.courseVersionId}` +
  `/modules/${s.moduleId}/sections/${s.sectionId}`;

export const peerReviewApi = {
  submitReflection(section: SectionRef, body: {text: string; confidence: number}) {
    return apiFetch<{reflectionId: string}>(`${sectionPath(section)}/reflections`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  getMyReflection(section: SectionRef) {
    return apiFetch<{reflection: MyReflection | null}>(
      `${sectionPath(section)}/reflections/me`,
    );
  },

  getNextForReview(section: SectionRef) {
    return apiFetch<{reflection: AnonymousReflection | null}>(
      `${sectionPath(section)}/review-queue/next`,
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

  listForInstructor(courseId: string, courseVersionId: string, sectionId?: string) {
    const query = sectionId ? `?sectionId=${sectionId}` : '';
    return apiFetch<{items: InstructorReflection[]}>(
      `${BASE_URL}/courses/${courseId}/versions/${courseVersionId}/reflections${query}`,
    );
  },

  getInstructorStats(
    courseId: string,
    courseVersionId: string,
    sectionId?: string,
  ) {
    const query = sectionId ? `?sectionId=${sectionId}` : '';
    return apiFetch<ReflectionStats>(
      `${BASE_URL}/courses/${courseId}/versions/${courseVersionId}/reflections/stats${query}`,
    );
  },
};
