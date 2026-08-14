/**
 * Client for the case-studies API.
 *
 * Written by hand, matching `lib/api/peer-reviews.ts`'s shape exactly — same
 * reasoning: these routes are new and not yet in the committed OpenAPI spec,
 * and this can be swapped for generated bindings later without touching the
 * hooks that consume it.
 */

const BASE_URL = `${import.meta.env.VITE_BASE_URL}/case-studies`;

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

export interface CourseVersionRef {
  courseId: string;
  versionId: string;
}

export type CaseState = 'locked' | 'writable' | 'submitted-awaiting-verdict' | 'won' | 'withdrawn';

export interface CaseListEntry {
  caseStudyId: string;
  sequenceIndex: number;
  title: string;
  bodyMarkdown: string;
  linkedItemId: string | null;
  state: CaseState;
  myResponse?: {
    text: string;
    weakStreak: number;
    eligibleForRevision: boolean;
  };
}

export interface MyCaseResponse {
  _id: string;
  userId: string;
  courseVersionId: string;
  caseStudyId: string;
  text: string;
  status: 'OPEN' | 'WON' | 'WITHDRAWN';
  winCount: number;
  comparisonsSeenCount: number;
  flagCount: number;
  createdAt: string;
  updatedAt: string;
}

export type PickOutcome = 'A' | 'B' | 'BOTH_WEAK' | 'FLAGGED';

/** One side of a served pair — deliberately has no author field anywhere. */
export interface ServedPairSide {
  responseId: string;
  text: string;
  wordCount: number;
  /**
   * Submit exactly this value as the pick outcome when the participant picks
   * this side. Sides are randomised left/right per serve, so never assume
   * "left" means outcome 'A' — always read it off the side itself.
   */
  outcome: 'A' | 'B';
}

export interface ServedPair {
  comparisonId: string;
  caseStudyId: string;
  left: ServedPairSide;
  right: ServedPairSide;
  /** ISO timestamp — the server-anchored timer origin, never a client-invented one. */
  servedAt: string;
  minimumScreenTimeSeconds: number;
}

export interface PickResult {
  outcome: PickOutcome;
  /** Readers of this exact pair (any reviewer) who chose the same outcome, this pick included. */
  agreementCount: number;
  /** Readers of this exact pair who gave a substantive verdict (A/B/BOTH_WEAK) — FLAGGED excluded. */
  totalJudged: number;
}

const coursePath = (r: CourseVersionRef) => `${BASE_URL}/courses/${r.courseId}/versions/${r.versionId}`;

export const caseStudyApi = {
  listCases(ref: CourseVersionRef) {
    return apiFetch<{cases: CaseListEntry[]}>(coursePath(ref));
  },

  getMyResponse(caseStudyId: string) {
    return apiFetch<{response: MyCaseResponse | null}>(`${BASE_URL}/${caseStudyId}/my-response`);
  },

  submitResponse(caseStudyId: string, text: string) {
    return apiFetch<{responseId: string}>(`${BASE_URL}/${caseStudyId}/responses`, {
      method: 'POST',
      body: JSON.stringify({text}),
    });
  },

  getNextPair(caseStudyId: string) {
    return apiFetch<{pair: ServedPair | null}>(`${BASE_URL}/${caseStudyId}/pairs/next`);
  },

  submitPick(comparisonId: string, outcome: PickOutcome) {
    return apiFetch<PickResult>(`${BASE_URL}/pairs/${comparisonId}/pick`, {
      method: 'POST',
      body: JSON.stringify({outcome}),
    });
  },

  reviseResponse(caseStudyId: string, text: string) {
    return apiFetch<{responseId: string}>(`${BASE_URL}/${caseStudyId}/responses`, {
      method: 'PATCH',
      body: JSON.stringify({text}),
    });
  },
};
