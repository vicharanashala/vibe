/**
 * Best-effort reporting for the two case-studies proctoring signals
 * (TAB_SWITCH_DURING_REVIEW, PASTE_ATTEMPTED — PLANNING.md §4.9).
 *
 * Reuses the existing `POST /anomalies/record/image` route rather than
 * adding a new one: `AnomalyService.recordAnomaly` already treats its file
 * argument as optional, so posting a plain JSON body with no attachment logs
 * a fileless anomaly through the same path the camera/audio detectors use.
 * A case-study pair/response id slots into `itemId` with no schema change,
 * exactly as PLANNING.md's proctoring-reuse note describes.
 *
 * This is a deterrent/log signal, not proof of anything (a paste can't be
 * proven server-side) — see PLANNING.md §4.8. It must never block the
 * learner's flow, so failures are swallowed.
 */

const BASE_URL = `${import.meta.env.VITE_BASE_URL}/anomalies`;

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('firebase-auth-token');
  return {
    'Content-Type': 'application/json',
    ...(token ? {Authorization: `Bearer ${token}`} : {}),
  };
}

export type CaseStudyAnomalyType = 'TAB_SWITCH_DURING_REVIEW' | 'PASTE_ATTEMPTED';

export function reportCaseStudyAnomaly(body: {
  type: CaseStudyAnomalyType;
  courseId: string;
  versionId: string;
  /** A case-study/comparison/response id — any valid ObjectId slots in here. */
  itemId: string;
}): void {
  fetch(`${BASE_URL}/record/image`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(body),
  }).catch(() => {
    // Best-effort: a lost integrity signal must never block the learner.
  });
}
